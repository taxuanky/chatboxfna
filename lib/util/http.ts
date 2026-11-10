/**
 * Fetch + retry + deadline — design.md §6.2 [M10][R3-M12].
 *
 * Đây là NƠI DUY NHẤT chính sách retry sống: cả adapter Gemini và adapter
 * OpenAI-compatible dùng chung file này, nên quy tắc 429 + 503 chỉ viết và test một lần.
 */

import type { Ctx } from '@/lib/kb/types';

/** Chừa chỗ để ghi event `error` + `citations` + `done` ra stream trước khi hàm bị kill. */
export const RESERVE_MS = 3000;

/**
 * Trần `maxDuration` mà DỰ ÁN NÀY đặt cho route (`export const maxDuration`), tính bằng giây.
 *
 * Đã kiểm thật (tài liệu Vercel, 2026 — xem `.agents/tasks/verify-gemini.md` mục 6): trần
 * của Hobby với Fluid compute là **300s**, không phải 60s như §21.2 hạng mục 8 giả định.
 * Vì trần nền tảng CAO HƠN và `maxDuration` là giá trị CẤU HÌNH ĐƯỢC, dự án giữ 60s thay vì
 * nâng lên 290s: toàn bộ các con số khác của thiết kế (`LLM_ATTEMPT_TIMEOUT_MS` 5000–45000
 * với lý do "45s + RESERVE_MS đã sát trần", và UX phân biệt "chờ" / "gọi IT" ở §14.2) chỉ
 * đúng khi deadline tổng là 50s. Nâng deadline lên 290s làm `canRetry` không bao giờ chặn
 * được gì và để một request trên hạn mức miễn phí chạy tới 5 phút.
 */
export const VERCEL_MAX_DURATION_S = 60;

/** Deadline tổng của một lượt `/api/chat`. Hằng duy nhất; không nhân bản con số này. */
export const DEADLINE_MS = 50_000;

// Lưới an toàn lúc nạp module: deadline phải thấp hơn trần một khoảng dự phòng.
if (DEADLINE_MS + 5_000 > VERCEL_MAX_DURATION_S * 1_000) {
  throw new Error(
    `Cấu hình sai: DEADLINE_MS (${DEADLINE_MS}) + 5000 vượt maxDuration ` +
    `(${VERCEL_MAX_DURATION_S}s). Sửa DEADLINE_MS, không sửa chỗ khác.`,
  );
}

/** Tối đa 4 lần thử trên model chính (§6.2). Số lần chỉ là TRẦN TRÊN; deadline mới chi phối. */
export const MAX_ATTEMPTS = 4;

/** Backoff 1 → 2 → 4 → 8 giây, jitter ±20%. */
export const BASE_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;

/**
 * Retry khi: 429, 500, 502, 503, 504 và lỗi mạng/timeout. Retry cho 429 VÀ 503 là BẮT BUỘC
 * — số đo thật cho thấy 503 là trạng thái thường gặp trên hạn mức miễn phí.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/**
 * KHÔNG retry 400/401/403/404: đó là lỗi cấu hình, retry chỉ làm chậm và che nguyên nhân thật.
 */
export function isConfigErrorStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

export type HttpErrorKind = 'http' | 'network' | 'timeout' | 'aborted';

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  /** 0 khi chưa có response nào (lỗi mạng / timeout). */
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly bodyText: string;

  constructor(opts: {
    kind: HttpErrorKind;
    status?: number;
    message: string;
    retryAfterSeconds?: number | null;
    bodyText?: string;
  }) {
    super(opts.message);
    this.name = 'HttpError';
    this.kind = opts.kind;
    this.status = opts.status ?? 0;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    this.bodyText = opts.bodyText ?? '';
  }
}

/**
 * [M10][R3-M12] Còn kịp thử lại không — quyết định bằng THỜI GIAN CÒN LẠI, không bằng số lần.
 *
 * `ctx` là THAM SỐ. Không dùng biến module-scope (sai trên serverless khi hai request dùng
 * chung instance) và không dùng AsyncLocalStorage (không có ở Edge).
 */
export function canRetry(ctx: Ctx, nextDelayMs: number, attemptTimeoutMs: number): boolean {
  return Date.now() + nextDelayMs + attemptTimeoutMs + RESERVE_MS < ctx.deadline;
}

/** Header `Retry-After` được ƯU TIÊN hơn backoff tính sẵn (§6.2). */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

/**
 * Độ trễ trước lần thử thứ `attempt + 1` (attempt tính từ 0).
 * `rng` là tham số để test chốt được con số thay vì chốt một khoảng.
 */
export function backoffDelayMs(
  attempt: number,
  retryAfterSeconds: number | null = null,
  rng: () => number = Math.random,
): number {
  if (retryAfterSeconds !== null) return Math.round(retryAfterSeconds * 1000);
  const base = BASE_DELAYS_MS[Math.min(attempt, BASE_DELAYS_MS.length - 1)];
  const jitter = (rng() * 2 - 1) * 0.2;   // ±20%
  return Math.max(0, Math.round(base * (1 + jitter)));
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new HttpError({ kind: 'aborted', message: 'Yêu cầu đã bị dừng.' }));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new HttpError({ kind: 'aborted', message: 'Yêu cầu đã bị dừng.' }));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export interface FetchWithRetryOptions {
  ctx: Ctx;
  /** Timeout MỖI LẦN THỬ, không phải tổng. */
  attemptTimeoutMs: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  rng?: () => number;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Gọi HTTP có retry, tôn trọng deadline tổng.
 *
 * Trả về `Response` ngay khi nhận được một response KHÔNG retryable — kể cả 4xx. Adapter
 * cần đọc được body của 400 (ví dụ để nhận ra Gemini từ chối `thinkingConfig`), nên biến
 * 4xx thành exception ở đây sẽ che mất thông tin đó.
 *
 * Throw `HttpError` khi: hết lần thử hoặc hết deadline trên một status retryable (giữ
 * NGUYÊN status của LẦN THỬ CUỐI để nguyên nhân thật không bị mất), hoặc chưa lần thử nào
 * hoàn tất (`kind: 'timeout'` → tầng trên map thành 504 LLM_TIMEOUT).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchWithRetryOptions,
): Promise<Response> {
  const {
    ctx,
    attemptTimeoutMs,
    maxAttempts = MAX_ATTEMPTS,
    fetchImpl = fetch,
    rng = Math.random,
    sleepImpl = sleep,
  } = opts;

  let lastError: HttpError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (ctx.signal?.aborted) {
      throw new HttpError({ kind: 'aborted', message: 'Yêu cầu đã bị dừng.' });
    }

    const controller = new AbortController();
    const onCtxAbort = () => controller.abort();
    ctx.signal?.addEventListener('abort', onCtxAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);

    let response: Response | null = null;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      const aborted = ctx.signal?.aborted === true;
      lastError = aborted
        ? new HttpError({ kind: 'aborted', message: 'Yêu cầu đã bị dừng.' })
        : new HttpError({
            kind: controller.signal.aborted ? 'timeout' : 'network',
            message: controller.signal.aborted
              ? `Hết thời gian chờ ${attemptTimeoutMs} ms khi gọi nhà cung cấp.`
              : `Lỗi mạng khi gọi nhà cung cấp: ${err instanceof Error ? err.message : String(err)}`,
          });
      if (aborted) throw lastError;
    } finally {
      clearTimeout(timer);
      ctx.signal?.removeEventListener('abort', onCtxAbort);
    }

    if (response) {
      if (!isRetryableStatus(response.status)) return response;
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      lastError = new HttpError({
        kind: 'http',
        status: response.status,
        message: `Nhà cung cấp trả ${response.status}.`,
        retryAfterSeconds: retryAfter,
        bodyText: await response.text().catch(() => ''),
      });
    }

    const isLastAttempt = attempt === maxAttempts - 1;
    if (isLastAttempt) break;

    const delay = backoffDelayMs(attempt, lastError?.retryAfterSeconds ?? null, rng);
    // Hết deadline ⇒ DỪNG NGAY, không bao giờ ngủ thêm rồi mới chết.
    if (!canRetry(ctx, delay, attemptTimeoutMs)) break;
    await sleepImpl(delay, ctx.signal);
  }

  throw lastError ?? new HttpError({ kind: 'timeout', message: 'Không có lần thử nào hoàn tất.' });
}
