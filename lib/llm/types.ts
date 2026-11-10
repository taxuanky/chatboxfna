/** Hợp đồng tầng LLM — design.md §5.3. Thay provider không được chạm tầng nào khác. */

import type { Ctx } from '@/lib/kb/types';

export type LlmProviderId = 'gemini' | 'openai-compatible' | 'mock';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Thông tin adapter báo lên MỘT LẦN, trước mảnh text đầu tiên.
 *
 * Vì sao là callback chứ không phải field trên provider: `streaming` chỉ biết được SAU khi
 * thử mở SSE, nên nó là dữ liệu CỦA MỘT LƯỢT. Giữ nó trong state của provider là đúng cái
 * bẫy mà R3-M12 cảnh báo cho `deadline` — trên serverless hai request dùng chung instance
 * thì lượt sau đọc được cờ của lượt trước.
 */
export interface LlmStreamMeta {
  /** false ⇔ đã hạ cấp khỏi SSE sang `:generateContent` (§6.2.1). */
  streaming: boolean;
  /** Model THỰC SỰ trả lời (có thể khác model cấu hình nếu dùng fallback). */
  model: string;
}

export interface LlmChatRequest {
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** [R3-M12] thay cho `signal?: AbortSignal` — `Ctx` giữ cả `signal` và `deadline`. */
  ctx: Ctx;
  /** Gọi đúng một lần trước mảnh text đầu tiên. */
  onMeta?: (meta: LlmStreamMeta) => void;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly model: string;
  /** Sinh từng mảnh text. KHÔNG BAO GIỜ trả thought/reasoning content. */
  stream(req: LlmChatRequest): AsyncIterable<string>;
  /** Dùng cho router miền: một lượt ngắn, không stream. */
  complete(req: LlmChatRequest): Promise<string>;
}
