/** Hợp đồng tầng embedding — design.md §5.3. */

import type { Ctx } from '@/lib/kb/types';

export type EmbeddingProviderId = 'gemini' | 'openai-compatible' | 'mock';

/**
 * Gemini dùng TASK TYPE BẤT ĐỐI XỨNG cho RAG (§6.3): nhúng tài liệu và nhúng câu hỏi phải
 * khác nhau. Nhúng câu hỏi bằng `RETRIEVAL_DOCUMENT` không báo lỗi gì, chỉ làm chất lượng
 * truy xuất tụt — nên sai chỗ này là bug IM LẶNG và unit test phải chốt mapping.
 */
export type EmbeddingKind = 'document' | 'query';

export interface EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly model: string;
  /** Số chiều THỰC TẾ: sau lần gọi đầu tiên đây là số float API trả về, không phải số yêu cầu. */
  readonly dim: number;
  /**
   * Trả về ĐÚNG một vector cho MỖI phần tử input, cùng thứ tự. Đã L2-normalize.
   *
   * Bất biến #2 (§15.3): việc L2-normalize xảy ra Ở ĐÂY — tầng adapter — trên MỌI vector,
   * ở CẢ `kind:'document'` VÀ `kind:'query'`, bất kể số chiều. Vector Gemini bị cắt chiều
   * KHÔNG có chuẩn 1 (đo thật: 768 chiều → 0,592158), nên nếu chỉ normalize lúc ingest thì
   * vector câu hỏi vẫn lệch và RAG xếp hạng SAI tài liệu — không crash, không log.
   */
  embedBatch(texts: string[], kind: EmbeddingKind, ctx: Ctx): Promise<number[][]>;
}
