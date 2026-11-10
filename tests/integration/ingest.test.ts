/**
 * Test tích hợp cho `scripts/ingest.ts` (§19.2).
 *
 * Chạy `runIngest()` TRỰC TIẾP trong tiến trình thay vì spawn `tsx`: mỗi ca cần một cây
 * `knowledge/` riêng và một `data/` riêng, và đường trực tiếp cho phép đọc được `logs` cùng
 * `report` mà không phải parse stdout. Embedding dùng provider `mock` (vitest.config.ts đặt
 * `EMBEDDING_PROVIDER=mock`), nên mọi ca ghi index thật đều chạy OFFLINE, không cần key.
 */

import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, isExcludedFromScan, parseIngestArgs, runIngest } from '@/scripts/ingest';
import type { IngestFlags } from '@/scripts/ingest';
import { l2norm } from '@/lib/util/cosine';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REAL_KNOWLEDGE = path.join(REPO_ROOT, 'knowledge');

/** Đồng hồ giả của mọi ca: 12 tài liệu mẫu ghi 2026-11-01 nên đều phải pass. */
const NOW = new Date('2026-11-05T00:00:00Z');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function tempDirs(): Promise<{ knowledgeRoot: string; dataDir: string }> {
  const base = await mkdtemp(path.join(tmpdir(), 'ingest-'));
  const knowledgeRoot = path.join(base, 'knowledge');
  const dataDir = path.join(base, 'data');
  await mkdir(knowledgeRoot, { recursive: true });
  return { knowledgeRoot, dataDir };
}

const BODY = [
  '## Mục thử nghiệm',
  '',
  'Nội dung đủ dài để vượt ngưỡng 50 ký tự của quy tắc thân tài liệu, và đủ dài để sinh ra',
  'một chunk có nghĩa cho bước embedding. Đoạn văn này nói về dinh dưỡng và tăng trọng để có',
  'từ khoá trùng với câu hỏi kiểm thử, nhờ đó truy xuất offline bằng provider mock vẫn đo',
  'được điều gì đó thay vì chỉ trả về danh sách rỗng.',
].join('\n');

function frontmatter(overrides: Record<string, unknown> = {}): string {
  const fields: Record<string, unknown> = {
    document_id: 'PIG-NUT-001',
    domain: 'pig_farming',
    category: 'PIG-05',
    doc_kind: 'general_guidance',
    title: 'Tài liệu thử nghiệm',
    source: 'Nội bộ – bản thảo demo',
    source_url: null,
    language: 'vi',
    publication_date: '2026-11-01',
    version: '"1.0"',
    last_reviewed: '2026-11-01',
    license_status: 'internal_draft',
    verification_status: 'in_review',
    reviewer: null,
    ...overrides,
  };
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value === null ? 'null' : String(value)}`);
  return ['---', ...lines, '---'].join('\n');
}

async function writeDoc(
  knowledgeRoot: string,
  relPath: string,
  overrides: Record<string, unknown> = {},
  body: string = BODY,
): Promise<void> {
  const full = path.join(knowledgeRoot, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, `${frontmatter(overrides)}\n\n${body}\n`, 'utf8');
}

function flags(overrides: Partial<IngestFlags> = {}): IngestFlags {
  return { ...DEFAULT_FLAGS, ...overrides };
}

// ─────────────────────────────────── Cờ dòng lệnh ───────────────────────────────────

describe('cờ dòng lệnh (§9.5)', () => {
  it('npm run ingest -- --dry-run cho đúng hai cờ', () => {
    const { flags: parsed, errors } = parseIngestArgs(['--fail-on-pii', '--dry-run']);
    expect(errors).toEqual([]);
    expect(parsed.failOnPii).toBe(true);
    expect(parsed.dryRun).toBe(true);
  });

  it('--allow-pii THIẾU --reason ⇒ bị từ chối', () => {
    const { errors } = parseIngestArgs(['--fail-on-pii', '--allow-pii']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('--reason');
  });

  it('--allow-pii --reason "<lý do>" ⇒ hợp lệ và giữ đúng lý do', () => {
    const { flags: parsed, errors } = parseIngestArgs([
      '--allow-pii', '--reason', 'dữ liệu đã ẩn danh',
    ]);
    expect(errors).toEqual([]);
    expect(parsed.allowPii).toBe(true);
    expect(parsed.reason).toBe('dữ liệu đã ẩn danh');
  });

  it('--reason bỏ trống giá trị ⇒ lỗi, không im lặng nhận cờ kế tiếp làm lý do', () => {
    const { errors } = parseIngestArgs(['--allow-pii', '--reason', '--strict']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('cờ lạ ⇒ lỗi, không bị bỏ qua im lặng', () => {
    const { errors } = parseIngestArgs(['--no-reuse-vectors']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('--no-reuse-vectors');
  });
});

// ───────────────────────────────── Loại trừ bước 1 ─────────────────────────────────

describe('loại trừ của bước 1', () => {
  it('loại _sources, mọi README.md, *.template.md, 05_Expert_Reviewed_QA, 06_Test_Dataset', () => {
    expect(isExcludedFromScan('_sources/sources.md')).toBe(true);
    expect(isExcludedFromScan('02_Cloud_Farm/README.md')).toBe(true);
    expect(isExcludedFromScan('01_Pig_Farming/05_Nutrition/README.md')).toBe(true);
    expect(isExcludedFromScan('01_Pig_Farming/05_Nutrition/doc.template.md')).toBe(true);
    expect(isExcludedFromScan('05_Expert_Reviewed_QA/qa-001.md')).toBe(true);
    expect(isExcludedFromScan('06_Test_Dataset/notes.md')).toBe(true);
    expect(isExcludedFromScan('01_Pig_Farming/05_Nutrition/PIG-NUT-001.md')).toBe(false);
  });
});

// ─────────────────────────── Dry-run trên knowledge/ thật ───────────────────────────

describe('ingest --dry-run trên knowledge/ thật', () => {
  it('0 lỗi validate, files === 15, ba tổng by_* bằng nhau và bằng chunks', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });

    expect(result.errors).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.wroteIndex).toBe(false);
    expect(result.stats).not.toBeNull();

    const stats = result.stats!;
    expect(stats.files).toBe(15);

    const sum = (r: Record<string, number | undefined>) =>
      Object.values(r).reduce<number>((a, v) => a + (v ?? 0), 0);
    expect(sum(stats.by_domain)).toBe(stats.chunks);
    expect(sum(stats.by_verification_status)).toBe(stats.chunks);
    expect(sum(stats.by_category)).toBe(stats.chunks);
    expect(sum(stats.by_doc_kind)).toBe(stats.chunks);
  });

  it('[H4] với đồng hồ giả 2026-11-05 thì KHÔNG có lỗi ngày nào', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });
    expect(result.errors.filter((e) => /date|reviewed/.test(e.field))).toEqual([]);
  });

  it('kho thật KHÔNG có tài liệu approved nào và có đúng 1 tài liệu hết hiệu lực', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });
    expect(result.stats!.by_verification_status.approved).toBe(0);
    expect(result.stats!.by_verification_status.rejected).toBe(0);
    expect(result.stats!.expired).toBe(1);
    expect(result.warnings.join('\n')).toContain('PIG-NUT-004');
  });

  it('cảnh báo Phụ lục B và cảnh báo kho CF rỗng đều được phát', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });
    const warnings = result.warnings.join('\n');
    expect(warnings).toContain('12/12');
    expect(warnings).toContain('needs_review');
    expect(warnings).toContain('02_Cloud_Farm/ không có tài liệu nào');
  });

  it('02_Cloud_Farm/README.md bị loại khỏi danh sách quét nên không vào stats.files', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });
    expect(result.stats!.by_domain.cloud_farm).toBe(0);
  });
});

// ─────────────────────────────── Lỗi cứng, không ghi ───────────────────────────────

describe('lỗi cứng ⇒ exit 1 và KHÔNG ghi index', () => {
  it('file thiếu document_id', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/thieu-id.md', {
      document_id: undefined,
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.wroteIndex).toBe(false);
    expect(result.errors.map((e) => e.field)).toContain('document_id');
    expect(await exists(path.join(dataDir, 'kb-index.json'))).toBe(false);
  });

  it('[H3] file .md ở thư mục NGOÀI PATH_TAXONOMY', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '08_Thu_Muc_La/PIG-NUT-001.md');

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.wroteIndex).toBe(false);
    const message = result.errors.map((e) => e.message).join('\n');
    expect(message).toContain('08_Thu_Muc_La');
    expect(message).toContain('PATH_TAXONOMY');
    expect(await exists(path.join(dataDir, 'kb-index.json'))).toBe(false);
  });

  it('ngày ở tương lai so với `now` được truyền vào', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md', {
      publication_date: '2026-11-06',
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.errors.map((e) => e.field)).toContain('publication_date');
  });

  it('superseded_by trỏ tới tài liệu không tồn tại', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '07_Archived_Superseded/PIG-NUT-004.md', {
      document_id: 'PIG-NUT-004', superseded_by: 'PIG-NUT-999',
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.errors.map((e) => e.field)).toContain('superseded_by');
  });

  it('approved thiếu reviewer ⇒ bị chặn ở cổng Ch.9', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md', {
      verification_status: 'approved', quality_score: 90,
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.errors.map((e) => e.field)).toContain('reviewer');
  });
});

// ───────────────────────────────── Bước 7: quét PII ─────────────────────────────────

describe('[M6] quét PII là LỖI CỨNG theo mặc định', () => {
  const EMAIL = 'nguyen.van.a@trangtrai-vi-du.vn';
  const PHONE = '0912345678';

  async function withPii(): Promise<{ knowledgeRoot: string; dataDir: string }> {
    const dirs = await tempDirs();
    await writeDoc(
      dirs.knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md', {},
      `${BODY}\n\nLiên hệ ${EMAIL} hoặc ${PHONE} để biết thêm.`,
    );
    return dirs;
  }

  it('exit 1, KHÔNG ghi index, log có LOẠI PII nhưng KHÔNG CÓ GIÁ TRỊ', async () => {
    const { knowledgeRoot, dataDir } = await withPii();
    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.wroteIndex).toBe(false);
    expect(await exists(path.join(dataDir, 'kb-index.json'))).toBe(false);

    const output = [...result.logs, ...result.errors.map((e) => e.message)].join('\n');
    expect(output).toContain('địa chỉ email');
    expect(output).toContain('số điện thoại');
    // In giá trị là tự rò rỉ chính thứ đang bị chặn — và báo cáo thì được commit vào một
    // repo đang PUBLIC.
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain(PHONE);
    expect(output).not.toContain('nguyen.van.a');
  });

  it('--allow-pii --reason ⇒ chạy tiếp, lý do có trong ingest-report.json', async () => {
    const { knowledgeRoot, dataDir } = await withPii();
    const result = await runIngest({
      knowledgeRoot,
      dataDir,
      now: NOW,
      flags: flags({ allowPii: true, reason: 'dữ liệu demo, đã xác nhận không phải người thật' }),
      log: () => {},
    });

    expect(result.exitCode).toBe(0);
    expect(result.wroteIndex).toBe(true);
    expect(result.stats!.pii_policy).toContain('allow-pii');

    const report = JSON.parse(
      await readFile(path.join(dataDir, 'ingest-report.json'), 'utf8'),
    ) as { pii_policy: string; flags: string[]; warnings: string[] };
    expect(report.pii_policy).toContain('dữ liệu demo');
    expect(report.flags).toContain('--allow-pii');
    // Báo cáo vẫn KHÔNG chứa giá trị PII nào.
    expect(JSON.stringify(report)).not.toContain('nguyen.van.a');
  });

  it('kho thật không có mẫu PII nào', async () => {
    const result = await runIngest({
      knowledgeRoot: REAL_KNOWLEDGE,
      dataDir: path.join(tmpdir(), 'khong-bao-gio-ghi'),
      now: NOW,
      flags: flags({ dryRun: true }),
      log: () => {},
    });
    expect(result.stats!.pii_policy).toBe('fail-on-pii');
    expect(result.errors.filter((e) => e.field === 'pii')).toEqual([]);
  });
});

// ───────────────── Bước 8: cơ chế bảo vệ repo public số 2 [M5] ─────────────────

describe('[M5] 02_Cloud_Farm/ có file .md ⇒ CẢNH BÁO, KHÔNG CHẶN', () => {
  it('in cảnh báo liệt kê từng file và nhắc kiểm chế độ repo, nhưng vẫn ghi index', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');
    await writeDoc(knowledgeRoot, '02_Cloud_Farm/02_SOP/CF-SOP-001.md', {
      document_id: 'CF-SOP-001',
      domain: 'cloud_farm',
      category: 'CF-02',
      doc_kind: 'internal_sop',
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    // KHÔNG chặn: tài liệu CF thật là thứ ta mong có.
    expect(result.exitCode).toBe(0);
    expect(result.wroteIndex).toBe(true);
    expect(result.errors).toEqual([]);

    const output = result.logs.join('\n');
    expect(output).toContain('02_Cloud_Farm/02_SOP/CF-SOP-001.md');
    expect(output).toContain('PUBLIC');
    expect(result.warnings.join('\n')).toContain('CHẾ ĐỘ REPO');
    expect(result.stats!.by_domain.cloud_farm).toBeGreaterThan(0);
  });
});

// ──────────────────────── [R2-N3] 05_Expert_Reviewed_QA ────────────────────────

describe('[R2-N3] .md dưới 05_Expert_Reviewed_QA/', () => {
  it('0 lỗi và KHÔNG nằm trong stats.files', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');

    // Cặp Q&A đầu tiên do chuyên gia duyệt KHÔNG được làm ingest dừng. File này không có
    // frontmatter và nằm ở thư mục không có trong PATH_TAXONOMY — tức nó đủ điều kiện để
    // sinh HAI lỗi cứng nếu nó bị quét.
    await mkdir(path.join(knowledgeRoot, '05_Expert_Reviewed_QA'), { recursive: true });
    await writeFile(
      path.join(knowledgeRoot, '05_Expert_Reviewed_QA', 'qa-001.md'),
      '# Q&A chuyên gia\n\nKhông có frontmatter, và điều đó không được làm ingest dừng.\n',
      'utf8',
    );

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.errors).toEqual([]);
    expect(result.exitCode).toBe(0);
    expect(result.stats!.files).toBe(1);
  });
});

// ───────────────────── Bước 4: rejected không bao giờ vào index ─────────────────────

describe('bước 4: rejected bị loại và được đếm vào stats.skipped', () => {
  it('[R3-N6] skipped đếm ĐÚNG số file rejected, không đếm file bị loại trừ ở bước 1', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-002.md', {
      document_id: 'PIG-NUT-002', verification_status: 'rejected',
    });
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/README.md', {
      document_id: 'PIG-NUT-003',
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });

    expect(result.exitCode).toBe(0);
    expect(result.stats!.files).toBe(1);
    expect(result.stats!.skipped).toBe(1);
    expect(result.stats!.by_verification_status.rejected).toBe(0);

    const index = JSON.parse(await readFile(path.join(dataDir, 'kb-index.json'), 'utf8')) as {
      chunks: Array<{ document_id: string }>;
    };
    expect(index.chunks.some((c) => c.document_id === 'PIG-NUT-002')).toBe(false);
    expect(index.chunks.some((c) => c.document_id === 'PIG-NUT-003')).toBe(false);
  });
});

// ──────────────── Bước 11 + 12: assertion, ghi nguyên tử, 4 file ────────────────

describe('bước 11 và 12', () => {
  it('ghi đủ 4 file, vectors_sha256 khớp, chuẩn L2 của mọi vector = 1 ± 0,001', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');
    await writeDoc(knowledgeRoot, '01_Pig_Farming/11_Production_KPI/PIG-KPI-001.md', {
      document_id: 'PIG-KPI-001', category: 'PIG-11',
    });

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });
    expect(result.exitCode).toBe(0);
    expect(result.wroteIndex).toBe(true);

    for (const name of ['kb-index.json', 'kb-vectors.bin', 'glossary.json', 'ingest-report.json']) {
      expect(await exists(path.join(dataDir, name)), `thiếu ${name}`).toBe(true);
    }
    // Ghi nguyên tử: không để lại file .tmp nào.
    for (const name of ['kb-index.json.tmp', 'kb-vectors.bin.tmp']) {
      expect(await exists(path.join(dataDir, name))).toBe(false);
    }

    const index = JSON.parse(await readFile(path.join(dataDir, 'kb-index.json'), 'utf8')) as {
      schema_version: number;
      embedding: {
        provider: string; dimension: number; normalized: boolean;
        vectors_bytes: number; vectors_sha256: string; vectors_file: string;
      };
      chunks: unknown[];
    };
    const bin = await readFile(path.join(dataDir, 'kb-vectors.bin'));

    expect(index.schema_version).toBe(1);
    expect(index.embedding.provider).toBe('mock');
    expect(index.embedding.normalized).toBe(true);
    expect(index.embedding.vectors_file).toBe('kb-vectors.bin');
    expect(bin.byteLength).toBe(index.embedding.vectors_bytes);
    expect(bin.byteLength).toBe(index.chunks.length * index.embedding.dimension * 4);
    expect(createHash('sha256').update(bin).digest('hex')).toBe(index.embedding.vectors_sha256);

    const dim = index.embedding.dimension;
    const floats = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
    for (let i = 0; i < index.chunks.length; i += 1) {
      expect(Math.abs(l2norm(floats.subarray(i * dim, (i + 1) * dim)) - 1)).toBeLessThan(0.001);
    }
  });

  it('bước 9 tái dùng vector theo content_hash ở lần chạy thứ hai', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');

    const first = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });
    expect(first.stats!.reused_vectors).toBe(0);

    const second = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });
    expect(second.stats!.reused_vectors).toBe(second.stats!.chunks);
    expect(second.stats!.chunks).toBeGreaterThan(0);
  });

  it('glossary.json được sinh với khoá khớp đã chuẩn hoá sẵn', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md');
    await writeDoc(
      knowledgeRoot,
      '04_Bilingual_Glossary/glossary.md',
      { document_id: 'PIG-GLO-001', category: 'PIG-GLOSSARY' },
      [
        '## Bảng thuật ngữ',
        '',
        'Đoạn mở đầu đủ dài để thân tài liệu vượt ngưỡng tối thiểu của quy tắc validate.',
        '',
        '| Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm |',
        '|---|---|---|---|---|---|',
        '| nái hậu bị | gilt | | | Nái chưa đẻ lứa nào. | Giai đoạn |',
      ].join('\n'),
    );

    const result = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags(), log: () => {},
    });
    expect(result.exitCode).toBe(0);

    const glossary = JSON.parse(
      await readFile(path.join(dataDir, 'glossary.json'), 'utf8'),
    ) as { version: number; terms: Array<{ vi: string; match_keys: string[] }> };
    expect(glossary.version).toBe(1);
    expect(glossary.terms).toHaveLength(1);
    expect(glossary.terms[0].match_keys).toContain('nai hau bi');
  });
});

// ───────────────────────────────────── --strict ─────────────────────────────────────

describe('--strict biến mọi cảnh báo còn lại thành lỗi', () => {
  it('cùng một kho: không --strict ⇒ exit 0, có --strict ⇒ exit 1', async () => {
    const { knowledgeRoot, dataDir } = await tempDirs();
    await writeDoc(knowledgeRoot, '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md', {
      animal_stage: '[heo thịt]',
    });

    const normal = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags({ dryRun: true }), log: () => {},
    });
    expect(normal.exitCode).toBe(0);
    expect(normal.warnings.length).toBeGreaterThan(0);

    const strict = await runIngest({
      knowledgeRoot, dataDir, now: NOW, flags: flags({ dryRun: true, strict: true }), log: () => {},
    });
    expect(strict.exitCode).toBe(1);
    // --strict không biến cảnh báo thành LỖI VALIDATE: nó chỉ đổi exit code.
    expect(strict.errors).toEqual([]);
    expect(strict.wroteIndex).toBe(false);
  });
});
