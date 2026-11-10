import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forIngest, forQuery } from '@/lib/embedding';
import { MOCK_EMBEDDING_DIM } from '@/lib/embedding/mock';
import { resetLogOnceForTests } from '@/lib/util/logger';
import type { IndexEmbeddingMeta } from '@/lib/kb/types';

const KEYS = [
  'EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'EMBEDDING_DIMENSION',
  'EMBEDDING_API_KEY', 'EMBEDDING_BASE_URL', 'GEMINI_API_KEY', 'GEMINI_BASE_URL',
];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetLogOnceForTests();
});
afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

const geminiIndexMeta: IndexEmbeddingMeta = {
  provider: 'gemini',
  embedding_model: 'gemini-embedding-001',
  dimension: 768,
  normalized: true,
  task_type_document: 'RETRIEVAL_DOCUMENT',
  vectors_file: 'kb-vectors.bin',
  vectors_bytes: 768 * 4,
  vectors_sha256: 'a'.repeat(64),
};

describe('forIngest — model và số chiều từ ENV', () => {
  it('provider mock không cần key', () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const result = forIngest();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider.dim).toBe(MOCK_EMBEDDING_DIM);
    expect(result.provider.model).toBe('mock-bow-hash-v1');
  });

  it('thiếu key ⇒ CONFIG_MISSING, KHÔNG throw', () => {
    process.env.EMBEDDING_PROVIDER = 'gemini';
    const result = forIngest();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFIG_MISSING');
  });

  it('lấy số chiều từ env khi env hợp lệ', () => {
    process.env.EMBEDDING_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'AQ.khoa';
    process.env.EMBEDDING_DIMENSION = '512';
    const result = forIngest();
    expect(result.ok && result.provider.dim).toBe(512);
  });
});

describe('forQuery — model và số chiều từ METADATA INDEX', () => {
  it('lấy model/dim từ index KỂ CẢ khi env đặt khác', () => {
    // Đây là lý do bỏ env ra khỏi vòng so sánh: local đặt 512 chạy tốt trong khi
    // production trả lỗi cho MỌI câu hỏi vì env trên Vercel vẫn là 768 (§9.4 kiểm tra #5).
    process.env.EMBEDDING_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'AQ.khoa';
    process.env.EMBEDDING_DIMENSION = '512';
    process.env.EMBEDDING_MODEL = 'mot-model-khac';

    const result = forQuery(geminiIndexMeta);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider.dim).toBe(768);
    expect(result.provider.model).toBe('gemini-embedding-001');
  });

  it('provider lệch ⇒ INDEX_PROVIDER_MISMATCH với message tiếng Việt', () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const result = forQuery(geminiIndexMeta);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INDEX_PROVIDER_MISMATCH');
    expect(result.message).toContain('không cùng không gian');
    expect(result.message).toContain('npm run ingest');
  });

  it('index mock + env mock ⇒ ok, dim 256', () => {
    process.env.EMBEDDING_PROVIDER = 'mock';
    const result = forQuery({
      ...geminiIndexMeta,
      provider: 'mock',
      embedding_model: 'mock-bow-hash-v1',
      dimension: MOCK_EMBEDDING_DIM,
    });
    expect(result.ok && result.provider.dim).toBe(MOCK_EMBEDDING_DIM);
  });
});
