import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGeminiLlmProvider, textFromCandidates } from '@/lib/llm/gemini';
import { HttpError } from '@/lib/util/http';
import { NdjsonDecoder, encodeNdjson } from '@/lib/util/ndjson';
import { resetLogOnceForTests } from '@/lib/util/logger';
import type { Ctx } from '@/lib/kb/types';
import type { LlmChatRequest, LlmStreamMeta } from '@/lib/llm/types';

/**
 * Deadline chỉ còn 1s: `canRetry` trả false ngay nên mỗi ca test chỉ tốn ĐÚNG MỘT lần thử,
 * không ngủ 1+2+4s thật. Đây cũng chính là hành vi [M10] yêu cầu.
 */
function tightCtx(): Ctx {
  return { requestId: 'test', deadline: Date.now() + 1_000 };
}

function request(overrides: Partial<LlmChatRequest> = {}): LlmChatRequest {
  return {
    system: 'Bạn là trợ lý trang trại.',
    messages: [
      { role: 'user', content: 'FCR tính thế nào?' },
      { role: 'assistant', content: 'FCR là tỉ lệ chuyển hoá thức ăn.' },
      { role: 'user', content: 'Còn giai đoạn nursery thì sao?' },
    ],
    ctx: tightCtx(),
    ...overrides,
  };
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function provider(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return createGeminiLlmProvider({
    apiKey: 'AQ.khoa-test',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.5-flash',
    fallbackModels: [],
    thinkingLevel: 'low',
    allowNonstreamFallback: true,
    attemptTimeoutMs: 20_000,
    fetchImpl,
    ...overrides,
  });
}

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of it) out.push(chunk);
  return out;
}

beforeEach(() => resetLogOnceForTests());

describe('textFromCandidates', () => {
  it('BỎ part có cờ thought — không bao giờ đẩy reasoning ra UI', () => {
    const text = textFromCandidates({
      candidates: [{
        content: {
          parts: [
            { text: 'người dùng hỏi về FCR, mình nên...', thought: true },
            { text: 'FCR là tỉ lệ chuyển hoá thức ăn.' },
          ],
        },
      }],
    });
    expect(text).toBe('FCR là tỉ lệ chuyển hoá thức ăn.');
  });

  it('nối nhiều part text theo thứ tự', () => {
    expect(textFromCandidates({
      candidates: [{ content: { parts: [{ text: 'A' }, { text: 'B' }] } }],
    })).toBe('AB');
  });
});

describe('giao thức và mapping', () => {
  it('xác thực bằng query param ?key= trên :streamGenerateContent?alt=sse', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n',
    ]));
    await collect(provider(fetchImpl as unknown as typeof fetch).stream(request()));
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':streamGenerateContent?alt=sse&key=AQ.khoa-test');
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it('map role assistant → model (Gemini không hiểu "assistant")', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"ok"}]}}]}\n\n',
    ]));
    await collect(provider(fetchImpl as unknown as typeof fetch).stream(request()));
    const body = JSON.parse(((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body) as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body.systemInstruction.parts[0].text).toContain('trợ lý trang trại');
  });

  it('gửi thinkingConfig khi GEMINI_THINKING_LEVEL có giá trị, và bỏ khi rỗng', async () => {
    const ok = () => sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"x"}]}}]}\n\n']);

    const withLevel = vi.fn().mockResolvedValue(ok());
    await collect(provider(withLevel as unknown as typeof fetch).stream(request()));
    const b1 = JSON.parse(((withLevel.mock.calls[0] as [string, RequestInit])[1].body) as string);
    expect(b1.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });

    const noLevel = vi.fn().mockResolvedValue(ok());
    await collect(
      provider(noLevel as unknown as typeof fetch, { thinkingLevel: '' }).stream(request()),
    );
    const b2 = JSON.parse(((noLevel.mock.calls[0] as [string, RequestInit])[1].body) as string);
    expect(b2.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('API trả 400 về thinkingConfig ⇒ thử lại ĐÚNG MỘT LẦN không kèm field', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(
        { error: { message: 'Unknown name "thinkingConfig"' } }, 400,
      ))
      .mockResolvedValueOnce(sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"vẫn trả lời được"}]}}]}\n\n',
      ]));

    const out = await collect(provider(fetchImpl as unknown as typeof fetch).stream(request()));
    expect(out.join('')).toBe('vẫn trả lời được');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const b2 = JSON.parse(((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body) as string);
    expect(b2.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('bỏ part thought khi đọc SSE', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"nội bộ","thought":true},',
      '{"text":"Phần hiển thị"}]}}]}\n\n',
    ]));
    const out = await collect(provider(fetchImpl as unknown as typeof fetch).stream(request()));
    expect(out.join('')).toBe('Phần hiển thị');
  });

  it('một dòng SSE bị cắt giữa hai mảnh TCP vẫn parse đúng', async () => {
    const line = 'data: {"candidates":[{"content":{"parts":[{"text":"Xin chào bà con"}]}}]}\n\n';
    const cut = Math.floor(line.length / 2);
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([line.slice(0, cut), line.slice(cut)]));
    const out = await collect(provider(fetchImpl as unknown as typeof fetch).stream(request()));
    expect(out.join('')).toBe('Xin chào bà con');
  });
});

describe('§6.2.1 hạ cấp khi SSE không khả dụng', () => {
  it('SSE lỗi 503 ⇒ tự gọi :generateContent và phát đúng chuỗi NDJSON với streaming=false',
    async () => {
      const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes(':streamGenerateContent')) {
          return new Response('quá tải', { status: 503 });
        }
        return jsonResponse({
          candidates: [{
            content: {
              parts: [
                { text: 'suy nghĩ nội bộ', thought: true },
                { text: 'FCR giai đoạn nursery thường thấp hơn.' },
              ],
            },
            finishReason: 'STOP',
          }],
        });
      });

      const metaRef: { value: LlmStreamMeta | null } = { value: null };
      const req = request({ onMeta: (m) => { metaRef.value = m; } });

      // Dựng đúng chuỗi event NDJSON như lib/chat/stream.ts sẽ làm.
      const wire: string[] = [];
      const tokens: string[] = [];
      for await (const piece of provider(fetchImpl as unknown as typeof fetch).stream(req)) {
        if (wire.length === 0) {
          wire.push(encodeNdjson({
            type: 'meta',
            streaming: metaRef.value?.streaming,
            model: metaRef.value?.model,
          }));
        }
        tokens.push(piece);
        wire.push(encodeNdjson({ type: 'token', text: piece }));
      }
      wire.push(encodeNdjson({ type: 'done', finish_reason: 'stop' }));

      const decoder = new NdjsonDecoder();
      const events = wire.flatMap((line) => decoder.push(line)) as Array<Record<string, unknown>>;

      expect(events[0]).toMatchObject({ type: 'meta', streaming: false });
      expect(events.at(-1)).toMatchObject({ type: 'done', finish_reason: 'stop' });
      expect(events.slice(1, -1).every((e) => e.type === 'token')).toBe(true);
      expect(tokens.length).toBeGreaterThan(1);        // phát theo TỪNG MẢNH NHỎ
      expect(tokens.join('')).toBe('FCR giai đoạn nursery thường thấp hơn.');
      expect(tokens.join('')).not.toContain('suy nghĩ nội bộ');
    });

  it('GEMINI_ALLOW_NONSTREAM_FALLBACK=false ⇒ báo lỗi thay vì hạ cấp', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('quá tải', { status: 503 }));
    const p = provider(fetchImpl as unknown as typeof fetch, { allowNonstreamFallback: false });
    const err = await collect(p.stream(request())).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
    // Không có lời gọi nào tới :generateContent
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes(':generateContent?'))).toBe(false);
  });

  it('cả hai đường thất bại ⇒ throw (tầng route map thành 502 LLM_UNAVAILABLE)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('quá tải', { status: 503 }));
    const p = provider(fetchImpl as unknown as typeof fetch);
    const err = await collect(p.stream(request())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
  });
});

describe('complete() — dùng cho router miền', () => {
  it('gọi :generateContent và trả text không kèm thought', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      candidates: [{ content: { parts: [{ text: 'nội bộ', thought: true }, { text: 'pig_farming' }] } }],
    }));
    const text = await provider(fetchImpl as unknown as typeof fetch).complete(request());
    expect(text).toBe('pig_farming');
    expect(String(fetchImpl.mock.calls[0][0])).toContain(':generateContent?key=');
  });
});
