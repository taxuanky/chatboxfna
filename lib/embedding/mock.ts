/**
 * Provider embedding `mock` — design.md §6.5 [M19].
 *
 * Mock là thành phần FIRST-CLASS, không phải tiện ích phụ: mọi bước xác minh chạy KHÔNG có
 * API key.
 */

import { l2normalize } from '@/lib/util/cosine';
import { logWarnOnce } from '@/lib/util/logger';
import type { EmbeddingKind, EmbeddingProvider } from './types';

/**
 * [M19] Định danh của mock là HẰNG SỐ trong code, không đọc env. Nếu để env quyết định thì
 * index mock có thể mang tên model của Gemini — đúng kiểu lẫn lộn không gian vector mà
 * kiểm tra #5 ở §9.4 được tạo ra để chặn.
 */
export const MOCK_EMBEDDING_ID = 'mock' as const;
export const MOCK_EMBEDDING_MODEL = 'mock-bow-hash-v1' as const;
export const MOCK_EMBEDDING_DIM = 256;

/**
 * [R3-M10] Ngưỡng liên quan khi chạy với mock: 0.05, KHÔNG phải 0.
 *
 * Mock dùng bag-of-words không âm nên mọi cosine >= 0. Với ngưỡng 0 thì MỌI chunk qua cổng
 * liên quan và nhánh `insufficient` — nửa thứ hai của Ch.10 quy tắc 2 — không thể test
 * offline. Một epsilon dương giữ cho nhánh "không liên quan" vẫn tồn tại.
 */
export const MOCK_MIN_COSINE = 0.05;

/** FNV-1a 32-bit: tất định, không phụ thuộc nền tảng, không cần thư viện. */
function hashToken(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Token hoá thô: bỏ dấu phụ, hạ chữ, cắt theo ký tự không phải chữ/số. */
function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Hashing trick kiểu bag-of-words rồi L2-normalize.
 *
 * Vì sao KHÔNG dùng số ngẫu nhiên theo hash: vector ngẫu nhiên tuy tất định nhưng không
 * mang chút tương đồng ngữ nghĩa nào, nên test truy xuất offline sẽ vô nghĩa. Bag-of-words
 * hash cho ĐỘ TƯƠNG ĐỒNG TỪ VỰNG THẬT — nhờ đó test tích hợp mới kiểm được "câu hỏi về FCR
 * truy ra tài liệu FCR".
 */
export function mockEmbed(text: string): number[] {
  const vec = new Array<number>(MOCK_EMBEDDING_DIM).fill(0);
  for (const token of tokenize(text)) {
    vec[hashToken(token) % MOCK_EMBEDDING_DIM] += 1;
  }
  return l2normalize(vec);
}

export function createMockEmbeddingProvider(): EmbeddingProvider {
  // Đọc trực tiếp process.env (không qua lib/config/env.ts) để tránh vòng import: env.ts
  // cần các hằng MOCK_* của file này.
  const requested = (process.env.EMBEDDING_DIMENSION ?? '').trim();
  if (requested !== '' && Number(requested) !== MOCK_EMBEDDING_DIM) {
    logWarnOnce(
      'mock-embedding-dim-ignored',
      `EMBEDDING_DIMENSION=${requested} bị BỎ QUA: provider mock luôn dùng ` +
      `${MOCK_EMBEDDING_DIM} chiều để index mock không thể lẫn với index Gemini.`,
    );
  }

  return {
    id: MOCK_EMBEDDING_ID,
    model: MOCK_EMBEDDING_MODEL,
    dim: MOCK_EMBEDDING_DIM,
    async embedBatch(texts: string[], _kind: EmbeddingKind): Promise<number[][]> {
      const vectors = texts.map(mockEmbed);
      if (vectors.length !== texts.length) {
        throw new Error(
          `Số vector (${vectors.length}) khác số văn bản (${texts.length}) — huỷ cả lần ingest.`,
        );
      }
      return vectors;
    },
  };
}
