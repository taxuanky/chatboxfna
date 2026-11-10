/**
 * Adapter chat Gemini — design.md §6.2 và §6.2.1.
 *
 * Mọi thông số ở đây là HÀNH VI ĐÃ ĐO THẬT (ngày 05/11/2026), không suy đoán:
 * - Xác thực bằng QUERY PARAM `?key=`. `Authorization: Bearer <key>` trả **401** → cấm dùng.
 * - `gemini-3.5-flash` → 200 OK. `gemini-2.5-flash` → **404** (key không truy cập được).
 * - `:streamGenerateContent?alt=sse` → **503** lúc đo, tức quá tải tạm thời; KHÔNG kết luận
 *   được endpoint đúng hay sai. Vì vậy §6.2.1 bắt buộc có đường hạ cấp: streaming là trải
 *   nghiệm tốt, KHÔNG phải yêu cầu chức năng.
 */

import { fetchWithRetry, HttpError } from '@/lib/util/http';
import { logWarnOnce } from '@/lib/util/logger';
import type { LlmChatRequest, LlmProvider } from './types';

export interface GeminiLlmOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** §6.2: mặc định TRỐNG. `gemini-3.8-flash` và `gemini-flash-latest` đã đo 503 CẢ HAI LẦN. */
  fallbackModels: string[];
  /** Chuỗi rỗng ⇒ không gửi `thinkingConfig`. */
  thinkingLevel: string;
  allowNonstreamFallback: boolean;
  attemptTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface GeminiPart {
  text?: string;
  /** Part được đánh dấu là suy nghĩ nội bộ. KHÔNG BAO GIỜ đẩy ra UI. */
  thought?: boolean;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

/** Role của assistant trong Gemini là `model`, không phải `assistant`. */
function toGeminiContents(req: LlmChatRequest) {
  return req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/** Lấy text của các part KHÔNG có cờ `thought`. */
export function textFromCandidates(payload: GeminiResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  let out = '';
  for (const part of parts) {
    if (part.thought === true) continue;
    if (typeof part.text === 'string') out += part.text;
  }
  return out;
}

function looksLikeThinkingConfigError(bodyText: string): boolean {
  return /thinking/i.test(bodyText);
}

export function createGeminiLlmProvider(opts: GeminiLlmOptions): LlmProvider {
  const fetchImpl = opts.fetchImpl;
  const base = opts.baseUrl.replace(/\/+$/, '');

  function buildBody(req: LlmChatRequest, includeThinking: boolean): string {
    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? 0.2,
      maxOutputTokens: req.maxOutputTokens ?? 2048,
    };
    if (includeThinking && opts.thinkingLevel !== '') {
      generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevel };
    }
    return JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toGeminiContents(req),
      generationConfig,
    });
  }

  /**
   * Gọi một endpoint của một model, có xử lý `thinkingConfig`.
   *
   * `thinkingConfig` là tham số CHƯA ĐƯỢC XÁC MINH trên key hiện tại. Nếu API trả 400 có
   * chuỗi liên quan tới field này thì thử lại ĐÚNG MỘT LẦN không kèm field, và `warn` một
   * lần duy nhất mỗi tiến trình. Mục đích: giảm độ trễ và token trên hạn mức miễn phí mà
   * không để một tên field đổi làm sập chat.
   */
  async function post(
    model: string,
    endpoint: 'streamGenerateContent' | 'generateContent',
    req: LlmChatRequest,
  ): Promise<Response> {
    const query = endpoint === 'streamGenerateContent'
      ? `?alt=sse&key=${encodeURIComponent(opts.apiKey)}`
      : `?key=${encodeURIComponent(opts.apiKey)}`;
    const url = `${base}/models/${model}:${endpoint}${query}`;

    const send = (includeThinking: boolean) => fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: buildBody(req, includeThinking),
      },
      { ctx: req.ctx, attemptTimeoutMs: opts.attemptTimeoutMs, fetchImpl },
    );

    const first = await send(true);
    if (first.status === 400 && opts.thinkingLevel !== '') {
      const bodyText = await first.text().catch(() => '');
      if (looksLikeThinkingConfigError(bodyText)) {
        logWarnOnce(
          'gemini-thinking-config-rejected',
          'API từ chối tham số thinkingConfig (400) — thử lại một lần không kèm tham số này. ' +
          'Đặt GEMINI_THINKING_LEVEL rỗng để bỏ hẳn.',
        );
        return send(false);
      }
      throw new HttpError({
        kind: 'http',
        status: 400,
        message: 'Gemini trả 400 (lỗi cấu hình request, không retry).',
        bodyText,
      });
    }
    return first;
  }

  /** Đọc SSE `data: {...}` và phát ra từng mảnh text. */
  async function* readSse(response: Response, signal?: AbortSignal): AsyncIterable<string> {
    const body = response.body;
    if (!body) throw new HttpError({ kind: 'network', message: 'Response SSE không có body.' });
    const reader = body.getReader();
    const decoder = new TextDecoder();
    // Một dòng SSE có thể bị cắt giữa hai mảnh TCP: phải đệm phần dở dang.
    let buffer = '';
    try {
      for (;;) {
        if (signal?.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl = buffer.indexOf('\n');
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf('\n');
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '' || payload === '[DONE]') continue;
          let parsed: GeminiResponse;
          try {
            parsed = JSON.parse(payload) as GeminiResponse;
          } catch {
            continue;   // mảnh không phải JSON hợp lệ: bỏ, không làm sập stream
          }
          const text = textFromCandidates(parsed);
          if (text !== '') yield text;
        }
      }
      const tail = buffer.trim();
      if (tail.startsWith('data:')) {
        const payload = tail.slice(5).trim();
        if (payload !== '' && payload !== '[DONE]') {
          try {
            const text = textFromCandidates(JSON.parse(payload) as GeminiResponse);
            if (text !== '') yield text;
          } catch {
            // bỏ qua mảnh cuối không hợp lệ
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Cắt câu trả lời một-lần thành từng mảnh nhỏ để client không cần nhánh xử lý riêng. */
  function* intoSmallChunks(text: string): Iterable<string> {
    const words = text.split(/(\s+)/).filter((s) => s.length > 0);
    for (const w of words) yield w;
  }

  async function callNonstream(model: string, req: LlmChatRequest): Promise<string> {
    const response = await post(model, 'generateContent', req);
    if (!response.ok) {
      throw new HttpError({
        kind: 'http',
        status: response.status,
        message: `Gemini :generateContent trả ${response.status}.`,
        bodyText: await response.text().catch(() => ''),
      });
    }
    return textFromCandidates((await response.json()) as GeminiResponse);
  }

  return {
    id: 'gemini',
    model: opts.model,

    async *stream(req: LlmChatRequest): AsyncIterable<string> {
      const models = [opts.model, ...opts.fallbackModels];
      let lastError: unknown = null;

      for (const model of models) {
        try {
          const response = await post(model, 'streamGenerateContent', req);
          if (!response.ok) {
            throw new HttpError({
              kind: 'http',
              status: response.status,
              message: `Gemini :streamGenerateContent trả ${response.status}.`,
              bodyText: await response.text().catch(() => ''),
            });
          }
          req.onMeta?.({ streaming: true, model });
          yield* readSse(response, req.ctx.signal);
          return;
        } catch (err) {
          if (err instanceof HttpError && err.kind === 'aborted') throw err;
          lastError = err;
          // Model kế tiếp chỉ được thử khi còn model trong danh sách fallback (§6.2).
        }
      }

      if (!opts.allowNonstreamFallback) {
        throw lastError instanceof Error
          ? lastError
          : new HttpError({ kind: 'network', message: 'Không mở được stream từ Gemini.' });
      }

      // §6.2.1 — hạ cấp: hết retry mà không mở được stream thì gọi `:generateContent` rồi
      // phát ra client theo từng mảnh nhỏ qua ĐÚNG giao thức NDJSON cũ. Client không cần
      // biết sự khác biệt; chỉ `meta.streaming=false` đổi, để UI hiện "Đang trả lời…".
      const text = await callNonstream(opts.model, req);
      req.onMeta?.({ streaming: false, model: opts.model });
      for (const piece of intoSmallChunks(text)) {
        if (req.ctx.signal?.aborted) return;
        yield piece;
      }
    },

    async complete(req: LlmChatRequest): Promise<string> {
      return callNonstream(opts.model, req);
    },
  };
}
