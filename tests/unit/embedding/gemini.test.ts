import { describe, expect, it, vi } from 'vitest';
import { createGeminiEmbeddingProvider } from '@/lib/embedding/gemini';
import { createOpenAiEmbeddingProvider } from '@/lib/embedding/openai-compatible';
import { l2norm } from '@/lib/util/cosine';
import type { Ctx } from '@/lib/kb/types';

const ctx: Ctx = { requestId: 'test', deadline: Number.POSITIVE_INFINITY };

/**
 * Số đo THẬT ngày 05/11/2026 trên `gemini-embedding-001`: vector 768 chiều trả về có
 * chuẩn L2 = 0,592158 — tức KHÔNG phải vector đơn vị. Fixture mô phỏng đúng con số đó.
 */
const MEASURED_NORM_768 = 0.592158;

function vectorWithNorm(dim: number, norm: number): number[] {
  const value = norm / Math.sqrt(dim);
  return new Array<number>(dim).fill(value);
}

function geminiOk(values: number[]): Response {
  return new Response(JSON.stringify({ embedding: { values } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeProvider(fetchImpl: typeof fetch, dimension = 768) {
  return createGeminiEmbeddingProvider({
    apiKey: 'AQ.khoa-test',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-embedding-001',
    dimension,
    attemptTimeoutMs: 20_000,
    fetchImpl,
  });
}

describe('bất biến #2 — L2-normalize ở TẦNG ADAPTER', () => {
  it('fixture chuẩn 0,592158 ⇒ sau adapter |v| = 1 ± 1e-6 với kind "document"', async () => {
    const raw = vectorWithNorm(768, MEASURED_NORM_768);
    expect(l2norm(raw)).toBeCloseTo(MEASURED_NORM_768, 6);   // fixture đúng số đo thật

    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(raw)) as unknown as typeof fetch;
    const [v] = await makeProvider(fetchImpl).embedBatch(['chunk tài liệu'], 'document', ctx);
    expect(Math.abs(l2norm(v) - 1)).toBeLessThan(1e-6);
  });

  it('fixture chuẩn 0,592158 ⇒ sau adapter |v| = 1 ± 1e-6 với kind "query"', async () => {
    // Đây là nửa dễ bị bỏ sót: nếu chỉ normalize lúc ingest thì vector CÂU HỎI vẫn mang
    // chuẩn 0,592 và điểm số lệch có hệ thống — không crash, không log.
    const raw = vectorWithNorm(768, MEASURED_NORM_768);
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(raw)) as unknown as typeof fetch;
    const [v] = await makeProvider(fetchImpl).embedBatch(['câu hỏi người dùng'], 'query', ctx);
    expect(Math.abs(l2norm(v) - 1)).toBeLessThan(1e-6);
  });

  it('normalize bất kể số chiều — kể cả vector 3072 đã là đơn vị', async () => {
    const raw = vectorWithNorm(3072, 1.0);
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(raw)) as unknown as typeof fetch;
    const [v] = await makeProvider(fetchImpl, 3072).embedBatch(['x'], 'document', ctx);
    expect(Math.abs(l2norm(v) - 1)).toBeLessThan(1e-6);
  });

  it('cũng normalize ở adapter openai-compatible, không tin tài liệu nhà cung cấp', async () => {
    const raw = vectorWithNorm(1536, 0.699158);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ index: 0, embedding: raw }] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = createOpenAiEmbeddingProvider({
      apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small', dimension: 1536, attemptTimeoutMs: 20_000, fetchImpl,
    });
    const [v] = await provider.embedBatch(['x'], 'document', ctx);
    expect(Math.abs(l2norm(v) - 1)).toBeLessThan(1e-6);
  });
});

describe('giao thức gọi Gemini', () => {
  it('xác thực bằng QUERY PARAM ?key=, KHÔNG dùng header Bearer (Bearer đã đo: 401)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(vectorWithNorm(768, 0.6)));
    await makeProvider(fetchImpl as unknown as typeof fetch).embedBatch(['x'], 'document', ctx);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('?key=AQ.khoa-test');
    expect(url).toContain(':embedContent');
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization');
  });

  it.each([
    ['document', 'RETRIEVAL_DOCUMENT'],
    ['query', 'RETRIEVAL_QUERY'],
  ] as const)('map kind "%s" → taskType %s', async (kind, taskType) => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(vectorWithNorm(768, 0.6)));
    await makeProvider(fetchImpl as unknown as typeof fetch).embedBatch(['x'], kind, ctx);
    const body = JSON.parse(((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body) as string);
    expect(body.taskType).toBe(taskType);
  });

  it('gửi outputDimensionality đúng giá trị cấu hình', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(vectorWithNorm(768, 0.6)));
    await makeProvider(fetchImpl as unknown as typeof fetch, 768)
      .embedBatch(['x'], 'document', ctx);
    const body = JSON.parse(((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body) as string);
    expect(body.outputDimensionality).toBe(768);
  });

  it('ghi SỐ CHIỀU THỰC TẾ đo được, không ghi giá trị đã yêu cầu', async () => {
    // Yêu cầu 768 nhưng API trả 3072 (tham số không được hỗ trợ): index phải nói đúng 3072.
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(vectorWithNorm(3072, 1)));
    const provider = makeProvider(fetchImpl as unknown as typeof fetch, 768);
    expect(provider.dim).toBe(768);
    await provider.embedBatch(['x'], 'document', ctx);
    expect(provider.dim).toBe(3072);
  });
});

describe('một input ⇒ một vector: assertion cứng', () => {
  it('trả đúng một vector cho MỖI văn bản, cùng thứ tự', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(geminiOk(vectorWithNorm(768, 0.59)))
      .mockResolvedValueOnce(geminiOk(vectorWithNorm(768, 0.59)))
      .mockResolvedValueOnce(geminiOk(vectorWithNorm(768, 0.59)));
    const vectors = await makeProvider(fetchImpl as unknown as typeof fetch)
      .embedBatch(['a', 'b', 'c'], 'document', ctx);
    expect(vectors).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('response không có embedding.values ⇒ throw, không trả vector rác', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: {} }), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(makeProvider(fetchImpl).embedBatch(['a'], 'document', ctx))
      .rejects.toThrow(/không có embedding.values/i);
  });

  it('số chiều lệch giữa các vector trong cùng lần chạy ⇒ throw', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(geminiOk(vectorWithNorm(768, 0.59)))
      .mockResolvedValueOnce(geminiOk(vectorWithNorm(512, 0.59)));
    await expect(
      makeProvider(fetchImpl as unknown as typeof fetch).embedBatch(['a', 'b'], 'document', ctx),
    ).rejects.toThrow(/không cùng độ dài/i);
  });

  it('vectors.length !== texts.length ⇒ throw và huỷ cả lần ingest (đường batch thật)', async () => {
    // Đây là cái bẫy §6.3 cảnh báo: một endpoint batch có thể gộp nhiều input thành MỘT
    // vector và KHÔNG báo lỗi nào. Assertion cứng làm lỗi nổ ra ngay thay vì âm thầm.
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ index: 0, embedding: vectorWithNorm(1536, 0.7) }] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const provider = createOpenAiEmbeddingProvider({
      apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small', dimension: 1536, attemptTimeoutMs: 20_000, fetchImpl,
    });
    await expect(provider.embedBatch(['a', 'b', 'c'], 'document', ctx))
      .rejects.toThrow(/Số vector \(1\) khác số văn bản \(3\)/);
  });

  it('openai-compatible sắp lại theo data[].index khi provider trả sai thứ tự', async () => {
    const v0 = vectorWithNorm(4, 0.7).map((_, i) => (i === 0 ? 1 : 0));
    const v1 = vectorWithNorm(4, 0.7).map((_, i) => (i === 1 ? 1 : 0));
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ index: 1, embedding: v1 }, { index: 0, embedding: v0 }],
      }), { status: 200 }),
    ) as unknown as typeof fetch;
    const provider = createOpenAiEmbeddingProvider({
      apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1',
      model: 'm', dimension: 4, attemptTimeoutMs: 20_000, fetchImpl,
    });
    const [a, b] = await provider.embedBatch(['a', 'b'], 'document', ctx);
    expect(a[0]).toBeCloseTo(1, 6);
    expect(b[1]).toBeCloseTo(1, 6);
  });
});
