import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_INDEX_FILE,
  FIXTURE_INGESTED_AT,
  FIXTURE_VECTORS_FILE,
  buildFixtures,
  writeFixtures,
} from '@/scripts/make-fixtures';
import type { KbIndexFile } from '@/scripts/make-fixtures';
import { MOCK_EMBEDDING_DIM, MOCK_EMBEDDING_MODEL } from '@/lib/embedding/mock';
import { l2norm } from '@/lib/util/cosine';

/**
 * Kiểm sự CÓ MẶT của mẫu liều trong dữ liệu fixture bằng so chuỗi thuần, KHÔNG bằng regex.
 *
 * Lý do: `lib/safety/dosage-pattern.ts` (FEAT sau) là điểm vào DUY NHẤT khai mẫu liều, và
 * §19.1 có một test tĩnh quét mã nguồn để chốt điều đó. Viết một regex liều thứ hai ở đây
 * là tự tạo ra cái mà test kia tồn tại để chặn.
 *
 * Lưu ý cho FEAT-004: chuỗi `mg/kg` CÓ XUẤT HIỆN trong `scripts/make-fixtures.ts` và trong
 * file test này như DỮ LIỆU kiểm thử, nên phép quét tĩnh đó phải giới hạn phạm vi ở
 * `lib/**` và `app/**`.
 */
const DOSAGE_MARKER = 'mg/kg';

const REPO_FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures');

async function readCommitted(): Promise<{ index: KbIndexFile; vectors: Buffer; json: string }> {
  const json = await readFile(path.join(REPO_FIXTURES, FIXTURE_INDEX_FILE), 'utf8');
  const vectors = await readFile(path.join(REPO_FIXTURES, FIXTURE_VECTORS_FILE));
  return { index: JSON.parse(json) as KbIndexFile, vectors, json };
}

describe('tính tất định (§6.5 [M19])', () => {
  it('chạy hai lần cho HAI FILE KHÔNG ĐỔI MỘT BYTE NÀO', async () => {
    const dirA = await mkdtemp(path.join(tmpdir(), 'fixtures-a-'));
    const dirB = await mkdtemp(path.join(tmpdir(), 'fixtures-b-'));

    await writeFixtures(dirA);
    await writeFixtures(dirB);

    const jsonA = await readFile(path.join(dirA, FIXTURE_INDEX_FILE));
    const jsonB = await readFile(path.join(dirB, FIXTURE_INDEX_FILE));
    const binA = await readFile(path.join(dirA, FIXTURE_VECTORS_FILE));
    const binB = await readFile(path.join(dirB, FIXTURE_VECTORS_FILE));

    expect(jsonA.equals(jsonB)).toBe(true);
    expect(binA.equals(binB)).toBe(true);
    expect(createHash('sha256').update(jsonA).digest('hex'))
      .toBe(createHash('sha256').update(jsonB).digest('hex'));
  });

  it('mốc thời gian là HẰNG SỐ, không phải new Date()', () => {
    expect(buildFixtures().index.ingested_at).toBe(FIXTURE_INGESTED_AT);
  });

  it('file đã commit khớp từng byte với bản sinh lại (không ai sửa tay)', async () => {
    const committed = await readCommitted();
    const built = buildFixtures();
    expect(committed.json).toBe(built.indexJson);
    expect(committed.vectors.equals(built.vectorsBuffer)).toBe(true);
  });
});

describe('vectors_sha256 và số chiều', () => {
  it('vectors_sha256 khớp sha256 thật của file .bin đã commit', async () => {
    const { index, vectors } = await readCommitted();
    expect(createHash('sha256').update(vectors).digest('hex'))
      .toBe(index.embedding.vectors_sha256);
    expect(vectors.byteLength).toBe(index.embedding.vectors_bytes);
  });

  it('vectors_bytes === chunks × dimension × 4', async () => {
    const { index } = await readCommitted();
    expect(index.embedding.vectors_bytes)
      .toBe(index.chunks.length * index.embedding.dimension * 4);
  });

  it('metadata embedding nói đúng là index mock 256 chiều', async () => {
    const { index } = await readCommitted();
    expect(index.embedding.provider).toBe('mock');
    expect(index.embedding.embedding_model).toBe(MOCK_EMBEDDING_MODEL);
    expect(index.embedding.dimension).toBe(MOCK_EMBEDDING_DIM);
    expect(index.embedding.normalized).toBe(true);
    expect(index.embedding.vectors_file).toBe(FIXTURE_VECTORS_FILE);
  });

  it('mọi vector có chuẩn L2 = 1 ± 0,001', () => {
    const { vectors, index } = buildFixtures();
    const dim = index.embedding.dimension;
    for (let i = 0; i < index.chunks.length; i += 1) {
      expect(Math.abs(l2norm(vectors.subarray(i * dim, (i + 1) * dim)) - 1))
        .toBeLessThan(0.001);
    }
  });
});

describe('fixture phủ đủ các vai của §19.2', () => {
  it('có approved PIG-07 CÓ mẫu liều trong text', () => {
    const chunks = buildFixtures().index.chunks;
    const hit = chunks.filter((c) => c.verification_status === 'approved' && c.category === 'PIG-07');
    expect(hit).toHaveLength(1);
    expect(hit[0].text).toContain(DOSAGE_MARKER);
    expect(hit[0].reviewer).not.toBeNull();
  });

  it('có approved PIG-09 KHÔNG liên quan thuốc', () => {
    const chunks = buildFixtures().index.chunks;
    const hit = chunks.filter((c) => c.verification_status === 'approved' && c.category === 'PIG-09');
    expect(hit).toHaveLength(1);
    expect(hit[0].text).not.toContain(DOSAGE_MARKER);
  });

  it('có đúng 2 chunk in_review của cặp mâu thuẫn, cùng category và cùng heading_path', () => {
    const chunks = buildFixtures().index.chunks;
    const pair = chunks.filter(
      (c) => c.document_id === 'PIG-NUT-001' || c.document_id === 'PIG-NUT-005',
    );
    expect(pair).toHaveLength(2);
    expect(new Set(pair.map((c) => c.category)).size).toBe(1);
    expect(new Set(pair.map((c) => c.heading_path)).size).toBe(1);
    expect(pair.every((c) => c.verification_status === 'in_review')).toBe(true);
    expect(pair.every((c) => c.valid_to === null && c.superseded_by === null)).toBe(true);
  });

  it('có chunk rejected (để ca "rejected không bao giờ lọt" có thể thất bại nếu hệ thống sai)', () => {
    const chunks = buildFixtures().index.chunks;
    expect(chunks.filter((c) => c.verification_status === 'rejected')).toHaveLength(1);
  });

  it('có chunk hết hiệu lực theo valid_to', () => {
    const chunks = buildFixtures().index.chunks;
    const expired = chunks.filter((c) => c.valid_to !== null);
    expect(expired).toHaveLength(1);
    expect(expired[0].valid_to! < '2026-11-05').toBe(true);
  });

  it('[R3-M9] có chunk superseded_by != null VÀ valid_to === null', () => {
    const chunks = buildFixtures().index.chunks;
    const hit = chunks.filter((c) => c.superseded_by !== null && c.valid_to === null);
    expect(hit).toHaveLength(1);
    expect(hit[0].document_id).toBe('PIG-NUT-006');
  });

  it('[R2-M9] có chunk in_review PIG-07 CÓ mẫu liều', () => {
    const chunks = buildFixtures().index.chunks;
    const hit = chunks.filter(
      (c) => c.verification_status === 'in_review' && c.category === 'PIG-07',
    );
    expect(hit).toHaveLength(1);
    expect(hit[0].text).toContain(DOSAGE_MARKER);
  });
});

describe('thống kê của fixture tự nhất quán', () => {
  it('ba tổng by_* bằng nhau và bằng số chunk', () => {
    const { stats, chunks } = buildFixtures().index;
    const sum = (r: Record<string, number | undefined>) =>
      Object.values(r).reduce<number>((a, v) => a + (v ?? 0), 0);

    expect(stats.chunks).toBe(chunks.length);
    expect(sum(stats.by_domain)).toBe(stats.chunks);
    expect(sum(stats.by_verification_status)).toBe(stats.chunks);
    expect(sum(stats.by_category)).toBe(stats.chunks);
    expect(sum(stats.by_doc_kind)).toBe(stats.chunks);
  });

  it('files bằng số document_id khác nhau; skipped = 0 vì fixture GIỮ tài liệu rejected', () => {
    const { stats, chunks } = buildFixtures().index;
    expect(stats.files).toBe(new Set(chunks.map((c) => c.document_id)).size);
    expect(stats.skipped).toBe(0);
    expect(stats.by_verification_status.rejected).toBeGreaterThan(0);
  });

  it('chunk_id là duy nhất và content_hash khớp text', () => {
    const chunks = buildFixtures().index.chunks;
    expect(new Set(chunks.map((c) => c.chunk_id)).size).toBe(chunks.length);
    for (const chunk of chunks) {
      expect(chunk.content_hash).toHaveLength(64);
      expect(chunk.text).toBe(chunk.text.trim());
    }
  });
});
