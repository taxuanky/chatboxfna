/**
 * Adapter embedding tương thích OpenAI — design.md §6.4.
 * Phủ OpenAI, OpenRouter, Groq, DeepSeek, Together và Ollama local.
 */

import type { Ctx } from '@/lib/kb/types';
import { l2normalize } from '@/lib/util/cosine';
import { fetchWithRetry, HttpError } from '@/lib/util/http';
import { logWarnOnce } from '@/lib/util/logger';
import type { EmbeddingKind, EmbeddingProvider } from './types';

export interface OpenAiEmbeddingOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  dimension: number;
  attemptTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface OpenAiEmbeddingResponse {
  data?: Array<{ index?: number; embedding?: number[] }>;
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function createOpenAiEmbeddingProvider(opts: OpenAiEmbeddingOptions): EmbeddingProvider {
  let measuredDim = opts.dimension;

  return {
    id: 'openai-compatible',
    model: opts.model,
    get dim(): number {
      return measuredDim;
    },

    async embedBatch(texts: string[], _kind: EmbeddingKind, ctx: Ctx): Promise<number[][]> {
      // Giao thức này KHÔNG có task type bất đối xứng, nên `kind` bị bỏ qua có chủ đích.
      // Hệ quả: chất lượng truy xuất thấp hơn đường Gemini một chút, không phải lỗi.
      if (texts.length === 0) return [];

      const headers: Record<string, string> = { 'content-type': 'application/json' };
      // Ollama local: host loopback được phép không có key và BỎ HẲN header Authorization.
      if (opts.apiKey !== '' || !isLoopback(opts.baseUrl)) {
        headers.authorization = `Bearer ${opts.apiKey}`;
      }

      const body: Record<string, unknown> = { model: opts.model, input: texts };
      // Nhiều endpoint tương thích OpenAI KHÔNG hỗ trợ `dimensions`; chỉ gửi khi được đặt.
      if (opts.dimension > 0) body.dimensions = opts.dimension;

      const response = await fetchWithRetry(
        `${opts.baseUrl.replace(/\/+$/, '')}/embeddings`,
        { method: 'POST', headers, body: JSON.stringify(body) },
        { ctx, attemptTimeoutMs: opts.attemptTimeoutMs, fetchImpl: opts.fetchImpl },
      );

      if (!response.ok) {
        throw new HttpError({
          kind: 'http',
          status: response.status,
          message: `Endpoint embedding trả ${response.status}.`,
          bodyText: await response.text().catch(() => ''),
        });
      }

      const json = (await response.json()) as OpenAiEmbeddingResponse;
      const data = json.data ?? [];

      // Một số provider trả KHÔNG đúng thứ tự: sắp lại theo `data[].index` trước khi dùng.
      const ordered = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const vectors = ordered.map((d) => {
        if (!Array.isArray(d.embedding) || d.embedding.length === 0) {
          throw new Error('Endpoint embedding trả phần tử không có mảng `embedding`.');
        }
        // Bất biến #2: KHÔNG giả định provider nào trả vector đơn vị, kể cả khi tài liệu
        // của họ nói vậy.
        return l2normalize(d.embedding);
      });

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

      const actual = vectors[0].length;
      if (actual !== measuredDim) {
        if (actual !== opts.dimension) {
          logWarnOnce(
            'openai-embedding-dim-mismatch',
            `API trả ${actual} chiều, khác ${opts.dimension} yêu cầu — tham số dimensions có ` +
            `thể không được hỗ trợ. Index vẫn dùng được, nhưng kích thước sẽ là ${actual} chiều.`,
          );
        }
        measuredDim = actual;
      }

      return vectors;
    },
  };
}
