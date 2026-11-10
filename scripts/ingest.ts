/**
 * `npm run ingest` — build kho kiến thức thành index (design.md §9.1, 13 bước).
 *
 * QUY TẮC PHÂN ĐỊNH ĐÃ ÁP (plan.md §0 quy tắc 2 + R3-M7): **§9.1 THẮNG sơ đồ §5.1.** Ba
 * chỗ sơ đồ §5.1 nói sai và KHÔNG được làm theo:
 *   (a) quét PII là **LỖI CỨNG theo mặc định** (không phải cảnh báo) — `--fail-on-pii` nằm
 *       ngay trong lệnh npm; bỏ qua phải tường minh `--allow-pii --reason "<lý do>"`;
 *   (b) retry backoff cho **429 VÀ 503** (503 là trạng thái thường gặp theo số đo thật) —
 *       chính sách này sống ở `lib/util/http.ts` và adapter đã dùng, ingest không cài lại;
 *   (c) **KHÔNG có bước L2-normalize trong ingest** — vector đã được normalize sẵn ở TẦNG
 *       ADAPTER (bất biến #2). Normalize lại ở đây là vô hại về số nhưng là sai về nơi
 *       cưỡng chế: nó làm người đọc tin rằng đường query cũng được normalize ở đâu đó.
 *
 * Script chạy ở MÁY LOCAL CÓ API KEY, không bao giờ chạy lúc Vercel build (§17.1).
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, rename, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { forIngest } from '@/lib/embedding';
import { getEmbeddingConfig, getRetrievalConfig } from '@/lib/config/env';
import { chunkDocument } from '@/lib/kb/chunk';
import { buildMatchKeys, parseGlossaryMarkdown } from '@/lib/kb/glossary';
import { formatPiiHits, scanPii } from '@/lib/kb/pii';
import type { PiiHit } from '@/lib/kb/pii';
import {
  KB_SCHEMA_VERSION,
  buildFrontmatterSchema,
  checkBody,
  checkCrossDocument,
  checkPathTaxonomy,
  collectWarnings,
  enforceChapter9,
  formatIssue,
  isExpired,
  narrowAnimalStages,
  sourcesFileSchema,
  zodIssuesToKbIssues,
} from '@/lib/kb/schema';
import type { Frontmatter, GlossaryTerm, KbIssue, ParsedDoc } from '@/lib/kb/schema';
import { l2norm } from '@/lib/util/cosine';
import type {
  Category, Ctx, DocKind, Domain, IndexStats, IndexedChunk, VerificationStatus,
} from '@/lib/kb/types';

// ───────────────────────────────────── Cờ dòng lệnh ─────────────────────────────────────

/** Đúng 4 mục (§9.5). KHÔNG thêm cờ nghịch `--no-reuse-vectors`: tái dùng vector theo
 *  `content_hash` là hành vi mặc định không điều kiện. */
export interface IngestFlags {
  failOnPii: boolean;
  allowPii: boolean;
  reason: string | null;
  strict: boolean;
  dryRun: boolean;
}

export const DEFAULT_FLAGS: IngestFlags = {
  failOnPii: true, allowPii: false, reason: null, strict: false, dryRun: false,
};

export function parseIngestArgs(argv: readonly string[]): { flags: IngestFlags; errors: string[] } {
  const flags: IngestFlags = { ...DEFAULT_FLAGS };
  const errors: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fail-on-pii') flags.failOnPii = true;
    else if (arg === '--allow-pii') flags.allowPii = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--reason') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        errors.push('--reason cần một lý do đi kèm, ví dụ: --allow-pii --reason "dữ liệu đã ẩn danh".');
      } else {
        flags.reason = value;
        i += 1;
      }
    } else if (arg.startsWith('--reason=')) {
      flags.reason = arg.slice('--reason='.length);
    } else {
      errors.push(`Cờ không hiểu: ${arg}. Cờ hợp lệ: --fail-on-pii, --allow-pii --reason "<lý do>", --strict, --dry-run.`);
    }
  }

  // [M6] `--allow-pii` thiếu `--reason` BỊ TỪ CHỐI. Bỏ qua một chốt chặn an toàn phải là
  // một hành động có người chịu trách nhiệm và có vết trong `data/ingest-report.json`.
  if (flags.allowPii && (flags.reason === null || flags.reason.trim() === '')) {
    errors.push(
      '--allow-pii bị TỪ CHỐI khi không có --reason "<lý do>". Lý do được ghi vào ' +
      'data/ingest-report.json để lần sau còn biết ai đã bỏ qua và vì sao.',
    );
  }
  return { flags, errors };
}

// ──────────────────────────────────── Kiểu kết quả ────────────────────────────────────

export interface IngestReport {
  ingested_at: string;
  duration_ms: number;
  stats: IndexStats;
  warnings: string[];
  pii_policy: string;
  flags: string[];
}

export interface IngestOptions {
  knowledgeRoot: string;
  dataDir: string;
  indexFileName?: string;
  vectorsFileName?: string;
  /** Đồng hồ là THAM SỐ — xem [H4] ở lib/kb/schema.ts. */
  now: Date;
  flags: IngestFlags;
  /** Mặc định in ra stdout. Test tiêm hàm khác để đọc lại từng dòng. */
  log?: (line: string) => void;
}

export interface IngestResult {
  exitCode: 0 | 1;
  errors: KbIssue[];
  warnings: string[];
  stats: IndexStats | null;
  logs: string[];
  wroteIndex: boolean;
  report: IngestReport | null;
}

// ──────────────────────────────── Bước 1: quét file ────────────────────────────────

/**
 * Loại trừ của bước 1 (§9.1).
 *
 * `05_Expert_Reviewed_QA/` phải nằm ở đây, không phải trong `PATH_TAXONOMY`: thư mục này
 * không có mã taxonomy nên theo quy tắc "thư mục lạ ⇒ lỗi cứng", CẶP Q&A ĐẦU TIÊN DO CHUYÊN
 * GIA DUYỆT SẼ LÀM INGEST DỪNG — đúng lúc dự án có thứ nó mong đợi nhất. Và Q&A chuyên gia
 * không phải tài liệu RAG: nó là dữ liệu cho fine-tuning (Ch.4.3) và cho bộ test (Ch.11),
 * không có `source`/`version`/`last_reviewed` thật để trích dẫn.
 */
const EXCLUDED_DIR_PREFIXES = ['_sources/', '05_Expert_Reviewed_QA/', '06_Test_Dataset/'];

export function isExcludedFromScan(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (EXCLUDED_DIR_PREFIXES.some((prefix) => norm.startsWith(prefix))) return true;
  const base = norm.slice(norm.lastIndexOf('/') + 1);
  if (/^readme\.md$/i.test(base)) return true;
  if (/\.template\.md$/i.test(base)) return true;
  return false;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  }
  await walk(root);
  // Sắp theo đường dẫn để kết quả ingest TẤT ĐỊNH (§9.1 bước 1).
  return out.sort((a, b) => a.localeCompare(b));
}

// ─────────────────────────── Bước 9: tái dùng vector cũ ───────────────────────────

interface ExistingIndex {
  embedding_model: string;
  dimension: number;
  byHash: Map<string, Float32Array>;
}

async function loadExistingIndex(
  indexPath: string,
  vectorsPath: string,
): Promise<ExistingIndex | null> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, 'utf8')) as {
      embedding?: { embedding_model?: string; dimension?: number };
      chunks?: Array<{ content_hash?: string }>;
    };
    const model = parsed.embedding?.embedding_model;
    const dimension = parsed.embedding?.dimension;
    const chunks = parsed.chunks;
    if (typeof model !== 'string' || typeof dimension !== 'number' || !Array.isArray(chunks)) {
      return null;
    }
    const buf = await readFile(vectorsPath);
    if (buf.byteLength !== chunks.length * dimension * 4) return null;

    const byHash = new Map<string, Float32Array>();
    for (let i = 0; i < chunks.length; i += 1) {
      const hash = chunks[i].content_hash;
      if (typeof hash !== 'string' || byHash.has(hash)) continue;
      const vec = new Float32Array(dimension);
      for (let d = 0; d < dimension; d += 1) {
        vec[d] = buf.readFloatLE((i * dimension + d) * 4);
      }
      byHash.set(hash, vec);
    }
    return { embedding_model: model, dimension, byHash };
  } catch {
    return null;
  }
}

// ──────────────────────────────────── Ghi nguyên tử ────────────────────────────────────

/** Viết `.tmp` rồi `rename`: một lần chạy lỗi không để lại index hỏng (§9.1 bước 12). */
async function writeAtomic(filePath: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, filePath);
}

// ───────────────────────────────────── Thân ingest ─────────────────────────────────────

const EMBED_BATCH_SIZE = 32;
const L2_SAMPLE_COUNT = 5;
const L2_TOLERANCE = 0.001;

export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const started = Date.now();
  const logs: string[] = [];
  const emit = (line: string): void => {
    logs.push(line);
    (options.log ?? ((l: string) => console.log(l)))(line);
  };

  const errors: KbIssue[] = [];
  const warnings: string[] = [];
  const { knowledgeRoot, dataDir, now, flags } = options;
  const indexFileName = options.indexFileName ?? 'kb-index.json';
  const vectorsFileName = options.vectorsFileName ?? 'kb-vectors.bin';

  const fail = (): IngestResult => {
    emit('');
    emit(`✖ Ingest DỪNG: ${errors.length} lỗi cứng. KHÔNG ghi index nào.`);
    for (const issue of errors) emit(`  ${formatIssue(issue)}`);
    return {
      exitCode: 1, errors, warnings, stats: null, logs, wroteIndex: false, report: null,
    };
  };

  // ── Bước 1: quét file ──
  const allFiles = await listMarkdownFiles(knowledgeRoot);
  const scanned = allFiles.filter((f) => !isExcludedFromScan(f));
  emit(`• Bước 1: thấy ${allFiles.length} file .md, quét ${scanned.length} (loại trừ ${allFiles.length - scanned.length}).`);

  // Danh mục nguồn: ĐỌC để cảnh báo pháp lý, không bao giờ để lấy nội dung (§7.2).
  await checkSourcesCatalog(path.join(knowledgeRoot, '_sources', 'sources.yaml'), errors, warnings);

  // ── Bước 2 + 3 + 5: parse, validate, đối chiếu đường dẫn, cưỡng chế Ch.9 ──
  const schema = buildFrontmatterSchema({ now });
  const parsed: ParsedDoc[] = [];
  const bodies = new Map<string, string>();
  const rawFiles = new Map<string, string>();

  for (const relPath of scanned) {
    const raw = await readFile(path.join(knowledgeRoot, relPath), 'utf8');
    rawFiles.set(relPath, raw);
    const file = matter(raw);
    const result = schema.safeParse(file.data);
    if (!result.success) {
      errors.push(...zodIssuesToKbIssues(relPath, result.error));
      continue;
    }
    const fm = result.data;
    errors.push(...checkPathTaxonomy({ relPath, fm, now }));
    errors.push(...checkBody(relPath, file.content));
    parsed.push({ relPath, fm });
    bodies.set(relPath, file.content);
  }

  errors.push(...checkCrossDocument(parsed));
  for (const doc of parsed) {
    for (const issue of collectWarnings(doc)) warnings.push(formatIssue(issue));
  }
  if (errors.length > 0) return fail();
  emit(`• Bước 2–3: ${parsed.length} tài liệu hợp lệ (frontmatter + PATH_TAXONOMY + liên kết toàn kho).`);

  // ── Bước 4: bỏ `verification_status: rejected` ──
  // Lớp phòng thủ 1 của bất biến "rejected không bao giờ được truy xuất" (Ch.3): tài liệu
  // bị loại ngay từ lúc build, nên không có đường nào để nó rò ra lúc chạy.
  const rejected = parsed.filter((d) => d.fm.verification_status === 'rejected');
  const accepted = parsed.filter((d) => d.fm.verification_status !== 'rejected');
  if (rejected.length > 0) {
    emit(`• Bước 4: loại ${rejected.length} tài liệu rejected: ${rejected.map((d) => d.fm.document_id).join(', ')}.`);
  }

  // ── Bước 5: cổng Ch.9 tường minh ──
  for (const doc of accepted) {
    for (const err of enforceChapter9(doc.fm)) {
      errors.push({ level: 'error', file: doc.relPath, field: err.field, message: err.message });
    }
  }
  if (errors.length > 0) return fail();

  // ── Bước 6: chunk ──
  const chunkOpts = readChunkOptions();

  const chunks: IndexedChunk[] = [];
  const expiredDocs: string[] = [];
  for (const doc of accepted) {
    const body = bodies.get(doc.relPath) ?? '';
    const docChunks = chunkDocument(doc.fm.document_id, body, chunkOpts);
    if (docChunks.length === 0) {
      errors.push({
        level: 'error', file: doc.relPath, field: 'body',
        message: 'không sinh được chunk nào — thân tài liệu không có nội dung dùng được.',
      });
      continue;
    }
    if (isExpired(doc.fm, now)) expiredDocs.push(doc.fm.document_id);
    for (const chunk of docChunks) chunks.push(toIndexedChunk(doc.fm, chunk));
  }
  if (errors.length > 0) return fail();
  emit(`• Bước 6: ${chunks.length} chunk từ ${accepted.length} tài liệu.`);

  // ── Bước 7: quét PII — LỖI CỨNG THEO MẶC ĐỊNH [M6] ──
  // Quét NGUYÊN FILE (kể cả frontmatter): một email lọt vào trường `reviewer` cũng là PII,
  // và `source_url` cũng là chỗ khoá API bị dán vào do nhầm.
  const piiFindings: Array<{ relPath: string; hits: PiiHit[] }> = [];
  for (const relPath of scanned) {
    const hits = scanPii(rawFiles.get(relPath) ?? '');
    if (hits.length > 0) piiFindings.push({ relPath, hits });
  }

  let piiPolicy = 'fail-on-pii';
  if (piiFindings.length > 0) {
    if (flags.allowPii && flags.reason !== null) {
      piiPolicy = `allow-pii: ${flags.reason}`;
      warnings.push(
        `Đã BỎ QUA ${piiFindings.length} file có mẫu PII theo --allow-pii. Lý do: "${flags.reason}".`,
      );
      for (const found of piiFindings) warnings.push(`  ${formatPiiHits(found.relPath, found.hits)}`);
    } else {
      emit('');
      emit('✖ Ingest DỪNG: phát hiện dữ liệu cá nhân (Ch.10 quy tắc 7)');
      for (const found of piiFindings) emit(`  ${formatPiiHits(found.relPath, found.hits)}`);
      emit('  (KHÔNG in giá trị). Xoá/ẩn danh rồi chạy lại, hoặc bỏ qua tường minh:');
      emit('  npx tsx scripts/ingest.ts --allow-pii --reason "<lý do>"');
      for (const found of piiFindings) {
        errors.push({
          level: 'error', file: found.relPath, field: 'pii',
          message: `phát hiện ${found.hits.map((h) => h.kind).join(', ')} — không ghi index.`,
        });
      }
      return {
        exitCode: 1, errors, warnings, stats: null, logs, wroteIndex: false, report: null,
      };
    }
  } else {
    emit('• Bước 7: không phát hiện mẫu PII nào.');
  }

  // ── Bước 8: CƠ CHẾ BẢO VỆ REPO PUBLIC SỐ 2 [M5] ──
  const cfFiles = allFiles.filter(
    (f) => f.startsWith('02_Cloud_Farm/') && !/\/readme\.md$/i.test(`/${f}`),
  );
  if (cfFiles.length > 0) {
    // Cảnh báo KHÔNG TẮT ĐƯỢC và KHÔNG CHẶN ingest: tài liệu CF thật là thứ ta mong có, chỉ
    // phải chắc repo đã private TRƯỚC ĐÓ. Chiều nguy hiểm là lúc thư mục KHÔNG CÒN RỖNG.
    emit('');
    emit('╔════════════════════════════════════════════════════════════════════════════╗');
    emit(`║ ⛔ CÓ ${String(cfFiles.length).padEnd(2)} TÀI LIỆU THẬT TRONG knowledge/02_Cloud_Farm/`.padEnd(77) + '║');
    for (const f of cfFiles) emit(`║    ${f}`.padEnd(77) + '║');
    emit('║    REPO NÀY CÓ ĐANG PUBLIC KHÔNG? Nếu có, DỪNG LẠI: chuyển repo sang      ║');
    emit('║    private hoặc tách kho kiến thức TRƯỚC KHI commit (Ch.10 q.7, Ch.14).   ║');
    emit('╚════════════════════════════════════════════════════════════════════════════╝');
    warnings.push(
      `${cfFiles.length} tài liệu trong knowledge/02_Cloud_Farm/ — KIỂM TRA CHẾ ĐỘ REPO ` +
      '(public/private) TRƯỚC KHI COMMIT (Ch.10 quy tắc 7, Ch.14).',
    );
  } else {
    warnings.push(
      'knowledge/02_Cloud_Farm/ không có tài liệu nào. Mọi câu hỏi Cloud Farm sẽ được trả lời ' +
      '"chưa có tài liệu" (Ch.2.2, Ch.10 quy tắc 5).',
    );
  }

  if (expiredDocs.length > 0) {
    warnings.push(
      `${expiredDocs.length} tài liệu đã hết hiệu lực hoặc đã bị thay thế: ${expiredDocs.join(', ')}.`,
    );
  }

  // ── Thống kê (ba tổng by_* phải bằng `chunks`) ──
  const stats = buildStats({
    files: accepted.length,
    skipped: rejected.length,
    chunks,
    expired: expiredDocs.length,
    reusedVectors: 0,
    piiPolicy,
  });

  // ── Bước 11 (phần không cần vector): ba assertion tổng ──
  const sumAssertions = [
    ['by_domain', sumValues(stats.by_domain)],
    ['by_verification_status', sumValues(stats.by_verification_status)],
    ['by_category', sumValues(stats.by_category)],
  ] as const;
  for (const [name, total] of sumAssertions) {
    if (total !== stats.chunks) {
      errors.push({
        level: 'error', file: '(stats)', field: name,
        message: `tổng ${name} = ${total} nhưng chunks = ${stats.chunks} — thống kê tự mâu thuẫn.`,
      });
    }
  }
  if (errors.length > 0) return fail();

  const glossaryTerms = await buildGlossaryTerms(knowledgeRoot, warnings);

  if (flags.dryRun) {
    const embeddingCfg = getEmbeddingConfig();
    emit('• --dry-run: BỎ QUA bước 9–12 (không gọi API embedding, không ghi file).');
    emit(embeddingCfg.ok
      ? `  Cấu hình embedding sẽ dùng: ${embeddingCfg.config.provider} / ${embeddingCfg.config.model} / ${embeddingCfg.config.dimension} chiều.`
      : '  Cấu hình embedding: chưa có key — dry-run không cần key.');
    const report = finish({
      emit, started, stats, warnings, flags, piiPolicy,
      embeddingLine: '(dry-run — chưa gọi API)',
      indexPathLabel: '(dry-run — chưa ghi file)',
      glossaryCount: glossaryTerms.length,
    });
    return {
      exitCode: strictExit(flags, warnings), errors, warnings, stats, logs,
      wroteIndex: false, report,
    };
  }

  // ── Bước 9 + 10: tái dùng vector, rồi embedding theo batch ──
  const providerResult = forIngest();
  if (!providerResult.ok) {
    errors.push({
      level: 'error', file: '(embedding)', field: 'config',
      message: providerResult.message,
    });
    return fail();
  }
  const provider = providerResult.provider;

  const indexPath = path.join(dataDir, indexFileName);
  const vectorsPath = path.join(dataDir, vectorsFileName);
  const existing = await loadExistingIndex(indexPath, vectorsPath);
  const reusable = existing !== null
    && existing.embedding_model === provider.model
    && existing.dimension === provider.dim
    ? existing.byHash
    : new Map<string, Float32Array>();

  const vectors: Array<Float32Array | null> = chunks.map((c) => reusable.get(c.content_hash) ?? null);
  const todo: number[] = [];
  vectors.forEach((v, i) => { if (v === null) todo.push(i); });
  const reusedVectors = chunks.length - todo.length;
  emit(`• Bước 9: tái dùng ${reusedVectors} vector theo content_hash; cần gọi API cho ${todo.length} chunk.`);

  // [R3-M12] Ingest không có request HTTP nào nên deadline là vô hạn; `ctx` vẫn là THAM SỐ
  // để `lib/util/http.ts` dùng đúng một cơ chế backoff cho cả hai đường.
  const ctx: Ctx = { requestId: 'ingest', deadline: Number.POSITIVE_INFINITY };

  for (let i = 0; i < todo.length; i += EMBED_BATCH_SIZE) {
    const slice = todo.slice(i, i + EMBED_BATCH_SIZE);
    const batch = await provider.embedBatch(slice.map((idx) => chunks[idx].text), 'document', ctx);
    if (batch.length !== slice.length) {
      errors.push({
        level: 'error', file: '(embedding)', field: 'batch',
        message: `nhận ${batch.length} vector cho ${slice.length} văn bản — huỷ cả lần ingest.`,
      });
      return fail();
    }
    slice.forEach((idx, j) => { vectors[idx] = Float32Array.from(batch[j]); });
  }

  const dimension = provider.dim;
  const flat = new Float32Array(chunks.length * dimension);
  for (let i = 0; i < chunks.length; i += 1) {
    const vec = vectors[i];
    if (vec === null || vec.length !== dimension) {
      errors.push({
        level: 'error', file: chunks[i].chunk_id, field: 'vector',
        message: `số chiều lệch: nhận ${vec?.length ?? 0}, cần ${dimension}.`,
      });
      return fail();
    }
    flat.set(vec, i * dimension);
  }

  // ── Bước 11: 5 assertion trước khi ghi ──
  if (flat.length !== chunks.length * dimension) {
    errors.push({
      level: 'error', file: '(vectors)', field: 'length',
      message: `vectors.length = ${flat.length} nhưng chunks × dimension = ${chunks.length * dimension}.`,
    });
    return fail();
  }
  // Ghi `normalized: true` mà không ĐO LẠI chính là cách bug chuẩn hoá lọt lưới: index vẫn
  // nạp được, chatbot vẫn trả lời trôi chảy, chỉ xếp hạng sai tài liệu mà không báo gì.
  for (const idx of sampleIndices(chunks.length, L2_SAMPLE_COUNT)) {
    const norm = l2norm(flat.subarray(idx * dimension, (idx + 1) * dimension));
    if (Math.abs(norm - 1) > L2_TOLERANCE) {
      errors.push({
        level: 'error', file: chunks[idx].chunk_id, field: 'vector',
        message:
          `chuẩn L2 = ${norm.toFixed(6)}, lệch quá ${L2_TOLERANCE} so với 1. Vector chưa được ` +
          'normalize ở tầng adapter (bất biến #2) — KHÔNG ghi normalized: true.',
      });
      return fail();
    }
  }
  emit(`• Bước 11: 5 assertion đạt (đã đo lại chuẩn L2 của ${Math.min(L2_SAMPLE_COUNT, chunks.length)} vector lấy mẫu).`);

  // ── Bước 12: ghi nguyên tử ──
  const finalStats = { ...stats, reused_vectors: reusedVectors };
  const vectorsBuffer = Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength);
  const vectorsSha256 = createHash('sha256').update(vectorsBuffer).digest('hex');
  const ingestedAt = new Date(started).toISOString();

  const indexJson = {
    schema_version: KB_SCHEMA_VERSION,
    ingested_at: ingestedAt,
    embedding: {
      provider: provider.id,
      embedding_model: provider.model,
      dimension,
      normalized: true as const,
      task_type_document: provider.id === 'gemini' ? 'RETRIEVAL_DOCUMENT' : null,
      vectors_file: vectorsFileName,
      vectors_bytes: vectorsBuffer.byteLength,
      vectors_sha256: vectorsSha256,
    },
    stats: finalStats,
    chunks,
  };

  const report: IngestReport = {
    ingested_at: ingestedAt,
    duration_ms: Date.now() - started,
    stats: finalStats,
    warnings,
    pii_policy: piiPolicy,
    flags: flagList(flags),
  };

  await mkdir(dataDir, { recursive: true });
  await writeAtomic(vectorsPath, vectorsBuffer);
  await writeAtomic(indexPath, `${JSON.stringify(indexJson, null, 2)}\n`);
  await writeAtomic(
    path.join(dataDir, 'glossary.json'),
    `${JSON.stringify({ version: 1, terms: glossaryTerms }, null, 2)}\n`,
  );
  await writeAtomic(
    path.join(dataDir, 'ingest-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const indexBytes = (await stat(indexPath)).size;
  finish({
    emit, started, stats: finalStats, warnings, flags, piiPolicy,
    embeddingLine:
      `${provider.id} / ${provider.model} / ${dimension} chiều / đã normalize ` +
      `(đã đo lại ${Math.min(L2_SAMPLE_COUNT, chunks.length)} vector)`,
    indexPathLabel:
      `${indexPath} (${Math.round(indexBytes / 1024)} KB) + ${vectorsPath} (${Math.round(vectorsBuffer.byteLength / 1024)} KB)`,
    glossaryCount: glossaryTerms.length,
  });

  return {
    exitCode: strictExit(flags, warnings), errors, warnings,
    stats: finalStats, logs, wroteIndex: true, report,
  };
}

// ───────────────────────────────────── Hàm phụ trợ ─────────────────────────────────────

function toIndexedChunk(
  fm: Frontmatter,
  chunk: { chunk_id: string; heading_path: string; text: string; token_estimate: number; content_hash: string },
): IndexedChunk {
  // [R3-M11] `quality_score`, `quality_breakdown` và `tags` CỐ Ý không vào index: hai cái
  // đầu là dữ liệu cho người duyệt (docs/QUALITY-RUBRIC.md), `tags` không có nơi nào đọc.
  // Ghi lại ở đây để lần sau không ai phải đoán thiếu là cố ý hay bỏ sót.
  return {
    chunk_id: chunk.chunk_id,
    document_id: fm.document_id,
    domain: fm.domain,
    category: fm.category,
    subcategory: fm.subcategory,
    doc_kind: fm.doc_kind,
    title: fm.title,
    source: fm.source,
    source_url: fm.source_url,
    language: fm.language,
    translated_language: fm.translated_language,
    translation_of: fm.translation_of,
    version: fm.version,
    publication_date: fm.publication_date,
    last_reviewed: fm.last_reviewed,
    valid_from: fm.valid_from,
    valid_to: fm.valid_to,
    superseded_by: fm.superseded_by,
    license_status: fm.license_status,
    verification_status: fm.verification_status,
    reviewer: fm.reviewer,
    exclusion_flags: fm.exclusion_flags,
    source_bias: fm.source_bias,
    animal_stage: narrowAnimalStages(fm.animal_stage),
    software_module: fm.software_module,
    heading_path: chunk.heading_path,
    text: chunk.text,
    token_estimate: chunk.token_estimate,
    content_hash: chunk.content_hash,
  };
}

function buildStats(args: {
  files: number;
  skipped: number;
  chunks: IndexedChunk[];
  expired: number;
  reusedVectors: number;
  piiPolicy: string;
}): IndexStats {
  const byDomain: Record<Domain, number> = { pig_farming: 0, cloud_farm: 0 };
  const byStatus: Record<VerificationStatus, number> = { approved: 0, in_review: 0, rejected: 0 };
  const byCategory: Partial<Record<Category, number>> = {};
  const byDocKind: Record<DocKind, number> = {
    general_guidance: 0, internal_sop: 0, legal_regulation: 0,
  };

  for (const chunk of args.chunks) {
    byDomain[chunk.domain] += 1;
    byStatus[chunk.verification_status] += 1;
    byCategory[chunk.category] = (byCategory[chunk.category] ?? 0) + 1;
    byDocKind[chunk.doc_kind] += 1;
  }

  return {
    files: args.files,
    chunks: args.chunks.length,
    // [R3-N6] `skipped` = SỐ FILE .md BỊ LOẠI VÌ `verification_status: rejected`. KHÔNG tính
    // file bị loại trừ ở bước 1, vì những file đó không bao giờ được quét.
    skipped: args.skipped,
    by_domain: byDomain,
    by_verification_status: byStatus,
    by_category: byCategory,
    by_doc_kind: byDocKind,
    expired: args.expired,
    reused_vectors: args.reusedVectors,
    pii_policy: args.piiPolicy,
  };
}

/**
 * `getRetrievalConfig()` không bao giờ trả `ok: false` (cấu hình sai dùng mặc định + warn),
 * nhưng kiểu của nó là union nên vẫn phải mở ra tường minh thay vì khẳng định bằng `!`.
 */
function readChunkOptions(): { maxTokens: number; minTokens: number; overlapTokens: number } {
  const result = getRetrievalConfig();
  if (!result.ok) return { maxTokens: 512, minTokens: 80, overlapTokens: 64 };
  return {
    maxTokens: result.config.chunkMaxTokens,
    minTokens: result.config.chunkMinTokens,
    overlapTokens: result.config.chunkOverlapTokens,
  };
}

function sumValues(record: Record<string, number | undefined>): number {
  return Object.values(record).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/** Chỉ số lấy mẫu rải đều và TẤT ĐỊNH — không dùng random để báo cáo lặp lại được. */
function sampleIndices(total: number, count: number): number[] {
  if (total === 0) return [];
  const n = Math.min(count, total);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(Math.floor((i * total) / n));
  return [...new Set(out)];
}

function flagList(flags: IngestFlags): string[] {
  const out: string[] = [];
  if (flags.failOnPii) out.push('--fail-on-pii');
  if (flags.allowPii) out.push('--allow-pii');
  if (flags.reason !== null) out.push(`--reason "${flags.reason}"`);
  if (flags.strict) out.push('--strict');
  if (flags.dryRun) out.push('--dry-run');
  return out;
}

/** `--strict` biến MỌI cảnh báo còn lại thành lỗi (§9.5). */
function strictExit(flags: IngestFlags, warnings: readonly string[]): 0 | 1 {
  return flags.strict && warnings.length > 0 ? 1 : 0;
}

async function checkSourcesCatalog(
  filePath: string,
  errors: KbIssue[],
  warnings: string[],
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    warnings.push('Không đọc được knowledge/_sources/sources.yaml — danh mục nguồn Phụ lục B đang thiếu.');
    return;
  }
  const parsed = sourcesFileSchema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    errors.push(...zodIssuesToKbIssues('_sources/sources.yaml', parsed.error));
    return;
  }
  const total = parsed.data.sources.length;
  const needsReview = parsed.data.sources.filter((s) => s.license_status === 'needs_review').length;
  if (needsReview > 0) {
    // Cảnh báo CỐ TÌNH không tắt được, để không ai quên bước pháp lý của Phụ lục B.
    warnings.push(
      `${needsReview}/${total} nguồn trong _sources/sources.yaml ở trạng thái needs_review — ` +
      'chưa được phép đưa nội dung vào kho kiến thức (Phụ lục B).',
    );
  }
}

async function buildGlossaryTerms(
  knowledgeRoot: string,
  warnings: string[],
): Promise<GlossaryTerm[]> {
  const filePath = path.join(knowledgeRoot, '04_Bilingual_Glossary', 'glossary.md');
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    warnings.push('Không đọc được knowledge/04_Bilingual_Glossary/glossary.md — data/glossary.json sẽ rỗng.');
    return [];
  }
  const terms = parseGlossaryMarkdown(matter(raw).content);
  if (terms.length === 0) {
    warnings.push('glossary.md không có mục nào đọc được — kiểm tra lại bảng 6 cột (§7.4).');
  }
  // Khoá khớp được chuẩn hoá SẴN ở đây để đường nóng không phải chuẩn hoá lại mỗi request.
  return terms.map((t) => ({ ...t, match_keys: buildMatchKeys(t) }));
}

function finish(args: {
  emit: (line: string) => void;
  started: number;
  stats: IndexStats;
  warnings: string[];
  flags: IngestFlags;
  piiPolicy: string;
  embeddingLine: string;
  indexPathLabel: string;
  glossaryCount: number;
}): IngestReport {
  const { emit, stats } = args;
  const duration = Date.now() - args.started;

  emit('');
  emit(`✔ Ingest hoàn tất trong ${(duration / 1000).toFixed(1)}s`);
  emit(`  Tài liệu   : ${stats.files} file  (${stats.skipped} bỏ qua vì rejected)`);
  emit(`  Chunk      : ${stats.chunks}  (tái dùng vector: ${stats.reused_vectors})`);
  emit(`  Embedding  : ${args.embeddingLine}`);
  emit(`  Index      : ${args.indexPathLabel}`);
  emit(`  Glossary   : ${args.glossaryCount} mục`);
  emit(`  Chính sách PII : ${args.piiPolicy}`);
  emit('');
  emit(`  Theo miền              : ${formatCounts(stats.by_domain)}`);
  emit(`  Theo trạng thái duyệt  : ${formatCounts(stats.by_verification_status)}`);
  emit(`  Theo nhóm              : ${formatCounts(stats.by_category)}`);
  emit(`  Theo doc_kind          : ${formatCounts(stats.by_doc_kind)}`);
  emit(`  Tổng ba bảng đầu = ${stats.chunks} = số chunk  ✔ (assertion §9.1 bước 11)`);

  if (args.warnings.length > 0) {
    emit('');
    for (const warning of args.warnings) emit(`⚠ ${warning}`);
    if (args.flags.strict) {
      emit('');
      emit(`✖ --strict: ${args.warnings.length} cảnh báo được tính là lỗi.`);
    }
  }

  return {
    ingested_at: new Date(args.started).toISOString(),
    duration_ms: duration,
    stats,
    warnings: args.warnings,
    pii_policy: args.piiPolicy,
    flags: flagList(args.flags),
  };
}

function formatCounts(record: Record<string, number | undefined>): string {
  const entries = Object.entries(record).filter(([, v]) => v !== undefined);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join(', ');
}

// ────────────────────────────────────── Điểm vào CLI ──────────────────────────────────────

async function main(): Promise<void> {
  const { flags, errors } = parseIngestArgs(process.argv.slice(2));
  if (errors.length > 0) {
    for (const err of errors) console.error(`✖ ${err}`);
    process.exit(1);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const retrieval = getRetrievalConfig();
  const kbIndexPath = retrieval.ok ? retrieval.config.kbIndexPath : './data/kb-index.json';
  const indexPath = path.resolve(repoRoot, kbIndexPath);

  const result = await runIngest({
    knowledgeRoot: path.join(repoRoot, 'knowledge'),
    dataDir: path.dirname(indexPath),
    indexFileName: path.basename(indexPath),
    now: new Date(),
    flags,
  });
  process.exit(result.exitCode);
}

const isDirectRun = process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  void main();
}
