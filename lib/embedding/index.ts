/**
 * Factory embedding — design.md §5.3 [M11].
 *
 * Có HAI cách gọi, và sự khác nhau giữa chúng là một quyết định kiến trúc, không phải tiện
 * lợi API:
 *
 * - `forIngest()`  — lúc build index: model và số chiều lấy TỪ ENV.
 * - `forQuery()`   — lúc trả lời: model và số chiều lấy TỪ METADATA CỦA INDEX; env chỉ còn
 *   cấp provider, key và baseUrl.
 *
 * Lý do: index là NGUỒN CHÂN LÝ cho không gian vector. Nếu đường query đọc số chiều từ env
 * thì local đặt `EMBEDDING_DIMENSION=512` chạy tốt trong khi production trả lỗi cho MỌI câu
 * hỏi vì env trên Vercel vẫn là 768 — hai nguồn sự thật để mà lệch. Bỏ env ra khỏi vòng so
 * sánh thì tình huống đó không tồn tại nữa.
 */

import type { EmbeddingConfig } from '@/lib/config/env';
import { getEmbeddingConfig } from '@/lib/config/env';
import type { IndexEmbeddingMeta } from '@/lib/kb/types';
import { createGeminiEmbeddingProvider } from './gemini';
import { createMockEmbeddingProvider } from './mock';
import { createOpenAiEmbeddingProvider } from './openai-compatible';
import type { EmbeddingProvider } from './types';

export type EmbeddingProviderResult =
  | { ok: true; provider: EmbeddingProvider }
  | { ok: false; code: 'CONFIG_MISSING' | 'INDEX_PROVIDER_MISMATCH'; message: string };

function build(cfg: EmbeddingConfig, model: string, dimension: number): EmbeddingProvider {
  switch (cfg.provider) {
    case 'mock':
      return createMockEmbeddingProvider();
    case 'openai-compatible':
      return createOpenAiEmbeddingProvider({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model,
        dimension,
        attemptTimeoutMs: cfg.attemptTimeoutMs,
      });
    case 'gemini':
    default:
      return createGeminiEmbeddingProvider({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model,
        dimension,
        attemptTimeoutMs: cfg.attemptTimeoutMs,
      });
  }
}

/** Đường ingest: model + số chiều từ env. */
export function forIngest(config?: EmbeddingConfig): EmbeddingProviderResult {
  if (config) return { ok: true, provider: build(config, config.model, config.dimension) };
  const result = getEmbeddingConfig();
  if (!result.ok) return { ok: false, code: 'CONFIG_MISSING', message: result.message };
  return {
    ok: true,
    provider: build(result.config, result.config.model, result.config.dimension),
  };
}

/**
 * Đường query: model + số chiều TỪ METADATA INDEX.
 *
 * Provider của index phải khớp provider đang cấu hình. Vector `mock` (bag-of-words 256
 * chiều) và vector Gemini (768 chiều ngữ nghĩa) KHÔNG cùng không gian dù có trùng số chiều:
 * so chúng với nhau không gây exception, chỉ cho điểm số vô nghĩa và chatbot trích dẫn tài
 * liệu sai một cách tự tin.
 */
export function forQuery(
  indexMeta: IndexEmbeddingMeta,
  config?: EmbeddingConfig,
): EmbeddingProviderResult {
  let cfg = config;
  if (!cfg) {
    const result = getEmbeddingConfig();
    if (!result.ok) return { ok: false, code: 'CONFIG_MISSING', message: result.message };
    cfg = result.config;
  }

  if (cfg.provider !== indexMeta.provider) {
    return {
      ok: false,
      code: 'INDEX_PROVIDER_MISMATCH',
      message:
        `Index được build bằng provider \`${indexMeta.provider}\` nhưng cấu hình hiện tại là ` +
        `\`${cfg.provider}\`. Vector của hai provider không cùng không gian. ` +
        'Chạy lại `npm run ingest`.',
    };
  }

  return {
    ok: true,
    provider: build(cfg, indexMeta.embedding_model, indexMeta.dimension),
  };
}

export type { EmbeddingProvider } from './types';
