import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_EMBEDDING_DIM,
  MOCK_EMBEDDING_ID,
  MOCK_EMBEDDING_MODEL,
  MOCK_MIN_COSINE,
  createMockEmbeddingProvider,
} from '@/lib/embedding/mock';
import { dot, l2norm } from '@/lib/util/cosine';
import { resetLogOnceForTests } from '@/lib/util/logger';
import type { Ctx } from '@/lib/kb/types';

const ctx: Ctx = { requestId: 'test', deadline: Number.POSITIVE_INFINITY };

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  delete process.env.EMBEDDING_DIMENSION;
  resetLogOnceForTests();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  delete process.env.EMBEDDING_DIMENSION;
});

describe('định danh là hằng số, không đọc env — [M19]', () => {
  it('id / model / dim cố định', () => {
    const p = createMockEmbeddingProvider();
    expect(p.id).toBe(MOCK_EMBEDDING_ID);
    expect(p.model).toBe(MOCK_EMBEDDING_MODEL);
    expect(p.dim).toBe(MOCK_EMBEDDING_DIM);
    expect(MOCK_EMBEDDING_DIM).toBe(256);
  });

  it('dim giữ 256 DÙ EMBEDDING_DIMENSION=768, kèm warn một lần', () => {
    process.env.EMBEDDING_DIMENSION = '768';
    const p = createMockEmbeddingProvider();
    expect(p.dim).toBe(256);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    createMockEmbeddingProvider();
    expect(warnSpy).toHaveBeenCalledTimes(1);     // một lần mỗi tiến trình
  });

  it('MOCK_MIN_COSINE là epsilon DƯƠNG để nhánh "không liên quan" còn tồn tại offline', () => {
    expect(MOCK_MIN_COSINE).toBeGreaterThan(0);
    expect(MOCK_MIN_COSINE).toBe(0.05);
  });
});

describe('hành vi vector', () => {
  it('deterministic: hai lần gọi cho cùng vector', async () => {
    const p = createMockEmbeddingProvider();
    const [a] = await p.embedBatch(['Nhu cầu dinh dưỡng giai đoạn nursery'], 'document', ctx);
    const [b] = await p.embedBatch(['Nhu cầu dinh dưỡng giai đoạn nursery'], 'document', ctx);
    expect(a).toEqual(b);
  });

  it('|v| ≈ 1 ở cả hai kind', async () => {
    const p = createMockEmbeddingProvider();
    for (const kind of ['document', 'query'] as const) {
      const [v] = await p.embedBatch(['Chỉ số FCR của đàn lợn thịt'], kind, ctx);
      expect(v).toHaveLength(256);
      expect(l2norm(v)).toBeCloseTo(1, 6);
    }
  });

  it('văn bản trùng từ vựng có cosine CAO HƠN văn bản không liên quan', async () => {
    const p = createMockEmbeddingProvider();
    const [q, gan, xa] = await p.embedBatch(
      [
        'cách tính FCR cho đàn lợn thịt',
        'FCR của đàn lợn thịt được tính theo lượng cám tiêu thụ',
        'quy định về đăng ký kinh doanh và con dấu doanh nghiệp',
      ],
      'query',
      ctx,
    );
    expect(dot(q, gan)).toBeGreaterThan(dot(q, xa));
  });

  it('một vector cho MỖI input, cùng thứ tự', async () => {
    const p = createMockEmbeddingProvider();
    const texts = ['một', 'hai', 'ba', 'bốn'];
    const vectors = await p.embedBatch(texts, 'document', ctx);
    expect(vectors).toHaveLength(texts.length);
    const [solo] = await p.embedBatch(['ba'], 'document', ctx);
    expect(vectors[2]).toEqual(solo);
  });

  it('văn bản rỗng không sinh NaN', async () => {
    const p = createMockEmbeddingProvider();
    const [v] = await p.embedBatch([''], 'document', ctx);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
});
