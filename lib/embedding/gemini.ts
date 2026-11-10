/**
 * Adapter embedding Gemini — design.md §6.3.
 *
 * **Bất biến #2 sống ở đây.** Số đo thật ngày 05/11/2026 trên `gemini-embedding-001`: vector
 * 768 chiều có chuẩn L2 = 0,592158, 1536 chiều = 0,699158, chỉ 3072 chiều = 1,000000. Nghĩa
 * là vector BỊ CẮT CHIỀU KHÔNG phải vector đơn vị. Nếu dùng dot product làm điểm tương đồng
 * (cách tối ưu phổ biến, vì người ta mặc định giả định vector đơn vị) thì điểm số lệch có hệ
 * thống và RAG xếp hạng SAI tài liệu — không crash, không log, chatbot vẫn trả lời trôi chảy
 * nhưng trích dẫn sai nguồn.
 *
 * Vì vậy `l2normalize()` chạy Ở ĐÂY, trên MỌI vector, ở CẢ `kind:'document'` VÀ
 * `kind:'query'`, BẤT KỂ số chiều — KHÔNG ở `scripts/ingest.ts`. Chỉ normalize lúc ingest
 * thì vector câu hỏi vẫn mang chuẩn 0,592 và điểm vẫn sai (R3-M7: sơ đồ §5.1 đặt sai chỗ,
 * bảng bất biến §15.3 thắng).
 */

import type { Ctx } from '@/lib/kb/types';
import { l2normalize } from '@/lib/util/cosine';
import { fetchWithRetry, HttpError } from '@/lib/util/http';
import { logWarnOnce } from '@/lib/util/logger';
import type { EmbeddingKind, EmbeddingProvider } from './types';

/** Gemini dùng task type BẤT ĐỐI XỨNG cho RAG. Sai mapping là bug im lặng. */
const TASK_TYPE: Record<EmbeddingKind, string> = {
  document: 'RETRIEVAL_DOCUMENT',
  query: 'RETRIEVAL_QUERY',
};

export interface GeminiEmbeddingOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Giá trị YÊU CẦU. Số chiều THỰC TẾ được đọc lại từ response đầu tiên. */
  dimension: number;
  attemptTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface EmbedContentResponse {
  embedding?: { values?: number[] };
}

export function createGeminiEmbeddingProvider(opts: GeminiEmbeddingOptions): EmbeddingProvider {
  let measuredDim = opts.dimension;

  async function embedOne(text: string, kind: EmbeddingKind, ctx: Ctx): Promise<number[]> {
    // Xác thực bằng QUERY PARAM `?key=`. Header `Authorization: Bearer <key>` đã đo: trả
    // 401. Không dùng Bearer.
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/models/${opts.model}:embedContent` +
      `?key=${encodeURIComponent(opts.apiKey)}`;

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: `models/${opts.model}`,
          content: { parts: [{ text }] },
          taskType: TASK_TYPE[kind],
          outputDimensionality: opts.dimension,
        }),
      },
      { ctx, attemptTimeoutMs: opts.attemptTimeoutMs, fetchImpl: opts.fetchImpl },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new HttpError({
        kind: 'http',
        status: response.status,
        message: `Gemini embedding trả ${response.status}.`,
        bodyText,
      });
    }

    const json = (await response.json()) as EmbedContentResponse;
    const values = json.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini embedding trả response không có embedding.values.');
    }

    // Ghi SỐ CHIỀU THỰC TẾ ĐO ĐƯỢC, không ghi giá trị đã yêu cầu — `outputDimensionality`
    // có thể không được hỗ trợ trên một model khác và index phải nói đúng sự thật (§6.3).
    if (measuredDim !== values.length) {
      if (values.length !== opts.dimension) {
        logWarnOnce(
          'gemini-embedding-dim-mismatch',
          `API trả ${values.length} chiều, khác ${opts.dimension} yêu cầu — tham số ` +
          'outputDimensionality có thể không được hỗ trợ. Index vẫn dùng được, nhưng ' +
          `kích thước sẽ là ${values.length} chiều.`,
        );
      }
      measuredDim = values.length;
    } else if (values.length !== measuredDim) {
      throw new Error(
        `Số chiều lệch giữa các vector trong cùng một lần chạy (${measuredDim} vs ${values.length}).`,
      );
    }

    return l2normalize(values);
  }

  return {
    id: 'gemini',
    model: opts.model,
    get dim(): number {
      return measuredDim;
    },

    async embedBatch(texts: string[], kind: EmbeddingKind, ctx: Ctx): Promise<number[][]> {
      // Gọi `:embedContent` MỘT LẦN CHO MỖI văn bản — đây là endpoint duy nhất đã đo thật
      // trong dự án này, và nó khiến "một input → một vector" thành đúng về cấu trúc.
      // §6.3 ghi nhận rủi ro ngược lại: `gemini-embedding-2` gộp nhiều input thành MỘT
      // vector tổng hợp và KHÔNG báo lỗi nào — index hỏng âm thầm. Chọn đường không thể
      // gặp cái bẫy đó, thay vì đường nhanh hơn một chút.
      const vectors: number[][] = [];
      for (const text of texts) {
        vectors.push(await embedOne(text, kind, ctx));
      }

      // Assertion CỨNG: lệch ⇒ throw, huỷ cả lần ingest. Lưới an toàn giữ nguyên dù hành
      // vi batch của model nào có khác tài liệu.
      if (vectors.length !== texts.length) {
        throw new Error(
          `Số vector (${vectors.length}) khác số văn bản (${texts.length}) — huỷ cả lần ingest. ` +
          'Không ghi index dở.',
        );
      }
      const dims = new Set(vectors.map((v) => v.length));
      if (dims.size > 1) {
        throw new Error(
          `Các vector trong cùng một lần chạy không cùng độ dài (${[...dims].join(', ')}).`,
        );
      }
      return vectors;
    },
  };
}
