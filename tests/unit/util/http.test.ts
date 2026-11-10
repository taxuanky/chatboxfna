import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE_DELAYS_MS,
  DEADLINE_MS,
  HttpError,
  RESERVE_MS,
  VERCEL_MAX_DURATION_S,
  backoffDelayMs,
  canRetry,
  fetchWithRetry,
  isConfigErrorStatus,
  isRetryableStatus,
  parseRetryAfter,
} from '@/lib/util/http';
import type { Ctx } from '@/lib/kb/types';

const ATTEMPT_TIMEOUT = 20_000;

function ctxWith(remainingMs: number): Ctx {
  return { requestId: 'test', deadline: Date.now() + remainingMs };
}

describe('phân loại status', () => {
  it('retry 429 và 503 — bắt buộc theo số đo thật, không phải tuỳ chọn', () => {
    for (const s of [429, 500, 502, 503, 504]) expect(isRetryableStatus(s)).toBe(true);
  });

  it('KHÔNG retry 400/401/403/404 — lỗi cấu hình, retry chỉ che nguyên nhân thật', () => {
    for (const s of [400, 401, 403, 404]) {
      expect(isRetryableStatus(s)).toBe(false);
      expect(isConfigErrorStatus(s)).toBe(true);
    }
  });
});

describe('hằng deadline', () => {
  it('DEADLINE_MS + 5s nằm trong trần maxDuration của route', () => {
    expect(DEADLINE_MS + 5_000).toBeLessThanOrEqual(VERCEL_MAX_DURATION_S * 1_000);
  });
});

describe('parseRetryAfter', () => {
  it('đọc dạng số giây', () => expect(parseRetryAfter('12')).toBe(12));
  it('bỏ qua giá trị rác', () => expect(parseRetryAfter('rất lâu')).toBeNull());
  it('null khi không có header', () => expect(parseRetryAfter(null)).toBeNull());
});

describe('backoffDelayMs', () => {
  it('tăng theo 1 → 2 → 4 → 8 giây với jitter ±20%', () => {
    for (let attempt = 0; attempt < BASE_DELAYS_MS.length; attempt += 1) {
      const base = BASE_DELAYS_MS[attempt];
      expect(backoffDelayMs(attempt, null, () => 0)).toBe(Math.round(base * 0.8));
      expect(backoffDelayMs(attempt, null, () => 1)).toBe(Math.round(base * 1.2));
      expect(backoffDelayMs(attempt, null, () => 0.5)).toBe(base);
    }
  });

  it('Retry-After được ưu tiên hơn backoff tính sẵn', () => {
    expect(backoffDelayMs(0, 7, () => 0.5)).toBe(7_000);
  });
});

describe('canRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T08:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('deadline còn 2s ⇒ KHÔNG được thử lại sau khi ngủ 8s', () => {
    expect(canRetry(ctxWith(2_000), 8_000, ATTEMPT_TIMEOUT)).toBe(false);
  });

  it('còn nhiều thời gian ⇒ được thử lại', () => {
    expect(canRetry(ctxWith(50_000), 1_000, ATTEMPT_TIMEOUT)).toBe(true);
  });

  it('chừa đúng RESERVE_MS để còn ghi error + citations + done ra stream', () => {
    const remaining = 1_000 + ATTEMPT_TIMEOUT + RESERVE_MS;
    expect(canRetry(ctxWith(remaining), 1_000, ATTEMPT_TIMEOUT)).toBe(false);
    expect(canRetry(ctxWith(remaining + 1), 1_000, ATTEMPT_TIMEOUT)).toBe(true);
  });
});

describe('fetchWithRetry', () => {
  let slept: number[];
  let sleepImpl: (ms: number) => Promise<void>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T08:00:00Z'));
    slept = [];
    sleepImpl = async (ms: number) => {
      slept.push(ms);
      vi.advanceTimersByTime(ms);
    };
  });
  afterEach(() => vi.useRealTimers());

  it('thử lại sau 503 rồi thành công', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('quá tải', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const res = await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(DEADLINE_MS),
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rng: () => 0.5,
      sleepImpl,
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([1_000]);
  });

  it('KHÔNG retry 400: trả Response để adapter đọc được body (ví dụ lỗi thinkingConfig)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('{"error":{"message":"thinkingConfig không hợp lệ"}}', { status: 400 }),
    );
    const res = await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(DEADLINE_MS),
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl,
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('thinkingConfig');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
  });

  it.each([401, 403])('KHÔNG retry %i', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status }));
    const res = await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(DEADLINE_MS),
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl,
    });
    expect(res.status).toBe(status);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tôn trọng header Retry-After thay vì backoff mặc định', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(DEADLINE_MS),
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rng: () => 0.5,
      sleepImpl,
    });
    expect(slept).toEqual([3_000]);
  });

  it('deadline còn 2s: KHÔNG ngủ rồi thử lại, trả NGAY mã lỗi của lần thử cuối', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('quá tải', { status: 503 }));
    const err = await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(2_000),
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rng: () => 0.5,
      sleepImpl,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);     // nguyên nhân thật không bị mất
    expect((err as HttpError).kind).toBe('http');
    expect(slept).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('tổng thời gian chuỗi retry không bao giờ vượt deadline', async () => {
    const start = Date.now();
    const deadline = start + DEADLINE_MS;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      // mỗi lần thử "tốn" đúng attemptTimeout rồi trả 503
      vi.advanceTimersByTime(ATTEMPT_TIMEOUT);
      return new Response('', { status: 503 });
    });

    const err = await fetchWithRetry('https://x.test', {}, {
      ctx: { requestId: 'test', deadline },
      attemptTimeoutMs: ATTEMPT_TIMEOUT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rng: () => 0.5,
      sleepImpl,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect(Date.now()).toBeLessThan(deadline);
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('lỗi mạng cũng được retry, và hết lần thử thì báo kind=network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const err = await fetchWithRetry('https://x.test', {}, {
      ctx: ctxWith(DEADLINE_MS),
      attemptTimeoutMs: 5_000,
      maxAttempts: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      rng: () => 0.5,
      sleepImpl,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).kind).toBe('network');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
