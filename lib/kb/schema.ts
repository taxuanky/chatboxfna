/**
 * Validate kho kiến thức — design.md §7.0, §8, §8.1 (+ R3-M11, R3-N6).
 *
 * Ba nhóm quy tắc sống ở đây, và sự tách nhóm là có chủ đích:
 *
 * 1. `buildFrontmatterSchema({ now })` — quy tắc TRONG MỘT FILE (kiểu, enum, ràng buộc
 *    liên-field Ch.9, quy tắc ngày). Đồng hồ là THAM SỐ, không phải `Date.now()` ẩn bên
 *    trong: nếu quy tắc ngày đọc đồng hồ thật ngay trong schema thì bộ test sẽ đổi kết quả
 *    theo ngày chạy — xanh hôm nay, đỏ sáu tháng sau mà không ai sửa gì ([H4]).
 * 2. `checkPathTaxonomy()` — quy tắc GIỮA ĐƯỜNG DẪN VÀ FRONTMATTER. Không có nhánh "đoán
 *    từ frontmatter": đoán chính là cách tài liệu lạc chỗ đi vào index.
 * 3. `checkCrossDocument()` — quy tắc CẦN CẢ KHO (`document_id` duy nhất, `superseded_by`
 *    và `translation_of` phải trỏ tới tài liệu TỒN TẠI). Một `superseded_by` trỏ sai là một
 *    tài liệu bị đánh dấu "đã thay thế" bởi một thứ không có, tức mất đường truy vết.
 */

import { z } from 'zod';
import type {
  AnimalStage, Category, DocKind, Domain, ExclusionFlag, VerificationStatus,
} from '@/lib/kb/types';

// ──────────────────────────── §7.0 PATH_TAXONOMY (23 khoá) ────────────────────────────

/**
 * Bảng ánh xạ đường dẫn → taxonomy, phủ ĐỦ MỌI thư mục có thể chứa `.md` ([H3]).
 *
 * `03_Vietnam_Legal/` có `domain: pig_farming` vì đề án chỉ có HAI miền (Ch.3): văn bản
 * pháp luật về chăn nuôi/thú y/môi trường là CĂN CỨ cho miền chăn nuôi, không phải một miền
 * thứ ba. Cái phân biệt nó là `doc_kind: legal_regulation` — field để encode Ch.10 quy tắc 6.
 */
export const PATH_TAXONOMY = {
  '01_Pig_Farming/01_Genetics_Breeding': { domain: 'pig_farming', category: 'PIG-01', doc_kind: 'general_guidance' },
  '01_Pig_Farming/02_Reproduction': { domain: 'pig_farming', category: 'PIG-02', doc_kind: 'general_guidance' },
  '01_Pig_Farming/03_Piglet_Management': { domain: 'pig_farming', category: 'PIG-03', doc_kind: 'general_guidance' },
  '01_Pig_Farming/04_Grow_Finish': { domain: 'pig_farming', category: 'PIG-04', doc_kind: 'general_guidance' },
  '01_Pig_Farming/05_Nutrition': { domain: 'pig_farming', category: 'PIG-05', doc_kind: 'general_guidance' },
  '01_Pig_Farming/06_Feed': { domain: 'pig_farming', category: 'PIG-06', doc_kind: 'general_guidance' },
  '01_Pig_Farming/07_Veterinary': { domain: 'pig_farming', category: 'PIG-07', doc_kind: 'general_guidance' },
  '01_Pig_Farming/08_Diseases': { domain: 'pig_farming', category: 'PIG-08', doc_kind: 'general_guidance' },
  '01_Pig_Farming/09_Biosecurity': { domain: 'pig_farming', category: 'PIG-09', doc_kind: 'general_guidance' },
  '01_Pig_Farming/10_Environment': { domain: 'pig_farming', category: 'PIG-10', doc_kind: 'general_guidance' },
  '01_Pig_Farming/11_Production_KPI': { domain: 'pig_farming', category: 'PIG-11', doc_kind: 'general_guidance' },
  '01_Pig_Farming/12_Farm_Economics': { domain: 'pig_farming', category: 'PIG-12', doc_kind: 'general_guidance' },
  '02_Cloud_Farm/01_User_Guide': { domain: 'cloud_farm', category: 'CF-01', doc_kind: 'general_guidance' },
  '02_Cloud_Farm/02_SOP': { domain: 'cloud_farm', category: 'CF-02', doc_kind: 'internal_sop' },
  '02_Cloud_Farm/03_Training': { domain: 'cloud_farm', category: 'CF-03', doc_kind: 'general_guidance' },
  '02_Cloud_Farm/04_FAQ_Tickets': { domain: 'cloud_farm', category: 'CF-04', doc_kind: 'general_guidance' },
  '02_Cloud_Farm/05_Business_Rules': { domain: 'cloud_farm', category: 'CF-05', doc_kind: 'internal_sop' },
  // Phụ lục A có 06_Reports_KPI và 07_Troubleshooting nhưng Ch.5.2 chỉ có CF-01..05:
  // báo cáo/KPI là "cách tính KPI" (CF-05), troubleshooting là "lỗi thường gặp" (CF-04).
  '02_Cloud_Farm/06_Reports_KPI': { domain: 'cloud_farm', category: 'CF-05', doc_kind: 'internal_sop' },
  '02_Cloud_Farm/07_Troubleshooting': { domain: 'cloud_farm', category: 'CF-04', doc_kind: 'general_guidance' },
  '03_Vietnam_Legal/Animal_Husbandry': { domain: 'pig_farming', category: 'PIG-LEGAL', doc_kind: 'legal_regulation' },
  '03_Vietnam_Legal/Veterinary': { domain: 'pig_farming', category: 'PIG-LEGAL', doc_kind: 'legal_regulation' },
  '03_Vietnam_Legal/Environment': { domain: 'pig_farming', category: 'PIG-LEGAL', doc_kind: 'legal_regulation' },
  '04_Bilingual_Glossary': { domain: 'pig_farming', category: 'PIG-GLOSSARY', doc_kind: 'general_guidance' },
} as const satisfies Record<string, { domain: Domain; category: Category; doc_kind: DocKind }>;

export type TaxonomyEntry = { domain: Domain; category: Category; doc_kind: DocKind };

/**
 * Thư mục được MIỄN đối chiếu path ↔ frontmatter, kèm RÀNG BUỘC BÙ (xem
 * `checkPathTaxonomy`). Miễn mà không có ràng buộc bù thì thư mục này thành chỗ lách mọi
 * kiểm tra taxonomy.
 */
export const PATH_CHECK_EXEMPT = ['07_Archived_Superseded'] as const;

export const DOCUMENT_ID_RE = /^(PIG|CF)-[A-Z]{3,5}-\d{3}$/;

export const LICENSE_STATUSES = [
  'internal_draft', 'internal_approved', 'public_domain',
  'permitted', 'needs_review', 'restricted',
] as const;

export const EXCLUSION_FLAGS = [
  'unclear_source', 'ocr_error_or_missing_tables', 'missing_version_or_date',
  'conflicts_with_current_regulation', 'unapproved_drug_or_dosage_guidance',
] as const;

export const ANIMAL_STAGES = [
  'nai_hau_bi', 'nai_mang_thai', 'nai_nuoi_con', 'lon_con',
  'nursery', 'grower', 'finisher', 'duc_giong',
] as const;

/** Thang điểm Ch.9: 6 tiêu chí, trọng số 20/25/15/15/15/10 (tổng 100). */
export const QUALITY_WEIGHTS = {
  source_reliability: 20,
  technical_accuracy: 25,
  currency: 15,
  completeness: 15,
  traceability: 15,
  language: 10,
} as const;

/** Ch.9: `approved` chỉ hợp lệ từ 85 điểm trở lên. */
export const APPROVED_MIN_QUALITY_SCORE = 85;

/** §8.1: thân tài liệu sau khi bỏ frontmatter. */
export const MIN_BODY_CHARS = 50;

/**
 * Phiên bản định dạng `data/kb-index.json` (§9.3). `lib/kb/store.ts` so khớp số này lúc nạp
 * và yêu cầu ingest lại nếu lệch, nên nó phải sống ở MỘT chỗ duy nhất.
 */
export const KB_SCHEMA_VERSION = 1;

// ─────────────────────────────────── Kết quả kiểm ───────────────────────────────────

export interface KbIssue {
  level: 'error' | 'warning';
  /** Đường dẫn tương đối tính từ `knowledge/`, luôn dùng `/`. */
  file: string;
  /** Tên field, hoặc `'path'` cho lỗi vị trí file, `'body'` cho lỗi thân bài. */
  field: string;
  message: string;
}

export function formatIssue(issue: KbIssue): string {
  return `${issue.file}:${issue.field}: ${issue.message}`;
}

// ───────────────────────────── §8.1 schema frontmatter ─────────────────────────────

/**
 * js-yaml của gray-matter biến `2026-11-01` (không ngoặc) thành một `Date` của JS. Nếu
 * schema chỉ nhận chuỗi thì MỌI tài liệu viết ngày theo cách tự nhiên nhất đều bị từ chối,
 * nên đổi về `YYYY-MM-DD` trước khi kiểm. Dùng UTC: `Date` do YAML sinh ra là mốc UTC.
 */
function toIsoDay(value: unknown): unknown {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'invalid-date';
    return value.toISOString().slice(0, 10);
  }
  return value;
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDay(fieldLabel: string) {
  return z.preprocess(
    toIsoDay,
    z.string().regex(ISO_DAY_RE, `${fieldLabel} phải đúng định dạng ISO YYYY-MM-DD`),
  );
}

function nullableIsoDay(fieldLabel: string) {
  return z.preprocess(
    (v) => (v === undefined ? null : toIsoDay(v)),
    z.union([
      z.string().regex(ISO_DAY_RE, `${fieldLabel} phải đúng định dạng ISO YYYY-MM-DD`),
      z.null(),
    ]),
  );
}

const languageEnum = z.enum(['vi', 'en']);

const qualityBreakdownSchema = z.object({
  source_reliability: z.number().min(0).max(100),
  technical_accuracy: z.number().min(0).max(100),
  currency: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  traceability: z.number().min(0).max(100),
  language: z.number().min(0).max(100),
});

export type QualityBreakdown = z.infer<typeof qualityBreakdownSchema>;

/** Điểm tổng có trọng số theo thang Ch.9. */
export function weightedQualityScore(breakdown: QualityBreakdown): number {
  let total = 0;
  for (const key of Object.keys(QUALITY_WEIGHTS) as Array<keyof typeof QUALITY_WEIGHTS>) {
    total += breakdown[key] * QUALITY_WEIGHTS[key];
  }
  return total / 100;
}

/**
 * Ba ràng buộc liên-field của Ch.9 + ràng buộc `quality_breakdown` (R3-M11).
 *
 * Đây là cách Ch.9 được CƯỠNG CHẾ BẰNG MÁY: một tài liệu không thể mang nhãn `approved`
 * mà thiếu người duyệt, thiếu điểm, điểm dưới 85, hay còn điều kiện loại trừ. Hàm tách
 * riêng để `scripts/ingest.ts` bước 5 gọi lại được như một cổng tường minh.
 */
export function enforceChapter9(fm: {
  verification_status: VerificationStatus;
  reviewer: string | null;
  quality_score: number | null;
  quality_breakdown: QualityBreakdown | null;
  exclusion_flags: readonly ExclusionFlag[];
}): Array<{ field: string; message: string }> {
  if (fm.verification_status !== 'approved') return [];
  const out: Array<{ field: string; message: string }> = [];

  if (fm.reviewer === null || fm.reviewer.trim() === '') {
    out.push({ field: 'reviewer', message: 'verification_status=approved nhưng chưa có reviewer (Ch.9).' });
  }
  if (fm.quality_score === null) {
    out.push({ field: 'quality_score', message: 'verification_status=approved nhưng thiếu quality_score (Ch.9).' });
  } else if (fm.quality_score < APPROVED_MIN_QUALITY_SCORE) {
    out.push({
      field: 'quality_score',
      message:
        `quality_score=${fm.quality_score} dưới ngưỡng ${APPROVED_MIN_QUALITY_SCORE} nên không thể ` +
        'approved (Ch.9: 85–100 → Approved, 70–84 → In Review).',
    });
  }
  if (fm.exclusion_flags.length > 0) {
    out.push({
      field: 'exclusion_flags',
      message:
        `còn ${fm.exclusion_flags.length} điều kiện loại trừ (${fm.exclusion_flags.join(', ')}) ` +
        'nên không thể approved dù điểm cao (Ch.9).',
    });
  }
  if (fm.quality_breakdown === null) {
    out.push({
      field: 'quality_breakdown',
      message: 'verification_status=approved nhưng thiếu quality_breakdown 6 tiêu chí Ch.9.',
    });
  } else if (fm.quality_score !== null) {
    const expected = weightedQualityScore(fm.quality_breakdown);
    if (Math.abs(expected - fm.quality_score) > 1) {
      out.push({
        field: 'quality_breakdown',
        message:
          `tổng có trọng số = ${expected.toFixed(2)} lệch quality_score=${fm.quality_score} ` +
          'quá 1 điểm (trọng số Ch.9: 20/25/15/15/15/10).',
      });
    }
  }
  return out;
}

/**
 * Schema frontmatter §8.1. `now` dùng cho quy tắc "ngày KHÔNG ở tương lai"; so sánh ở mức
 * NGÀY theo UTC vì metadata chỉ có độ phân giải ngày.
 */
export function buildFrontmatterSchema({ now }: { now: Date }) {
  const today = now.toISOString().slice(0, 10);

  const base = z.object({
    document_id: z.string().regex(
      DOCUMENT_ID_RE,
      'document_id phải khớp ^(PIG|CF)-[A-Z]{3,5}-\\d{3}$, ví dụ PIG-NUT-001',
    ),
    domain: z.enum(['pig_farming', 'cloud_farm']),
    category: z.enum([
      'PIG-01', 'PIG-02', 'PIG-03', 'PIG-04', 'PIG-05', 'PIG-06',
      'PIG-07', 'PIG-08', 'PIG-09', 'PIG-10', 'PIG-11', 'PIG-12',
      'PIG-GLOSSARY', 'PIG-LEGAL',
      'CF-01', 'CF-02', 'CF-03', 'CF-04', 'CF-05',
    ]),
    doc_kind: z.enum(['general_guidance', 'internal_sop', 'legal_regulation']),
    subcategory: z.union([z.string(), z.null()]).optional().transform((v) => v ?? null),
    title: z.string().min(1).max(200),
    source: z.string().min(1).max(200),
    // "Có mặt" chứ không "có giá trị": thiếu hẳn khoá là lỗi, `null` là hợp lệ.
    source_url: z.union([z.string().url('source_url phải là URL http(s) hoặc null'), z.null()]),

    language: languageEnum,
    translated_language: z.union([languageEnum, z.null()]).optional().transform((v) => v ?? null),
    translation_of: z.union([
      z.string().regex(DOCUMENT_ID_RE, 'translation_of phải là một document_id hợp lệ'),
      z.null(),
    ]).optional().transform((v) => v ?? null),

    publication_date: isoDay('publication_date'),
    version: z.string().min(1, 'version phải là chuỗi không rỗng — nhớ đặt trong ngoặc kép, vì YAML đọc 1.0 thành số'),
    last_reviewed: isoDay('last_reviewed'),
    valid_from: nullableIsoDay('valid_from'),
    valid_to: nullableIsoDay('valid_to'),
    superseded_by: z.union([
      z.string().regex(DOCUMENT_ID_RE, 'superseded_by phải là một document_id hợp lệ'),
      z.null(),
    ]).optional().transform((v) => v ?? null),

    license_status: z.enum(LICENSE_STATUSES),
    verification_status: z.enum(['approved', 'in_review', 'rejected']),
    reviewer: z.union([z.string(), z.null()]),

    quality_score: z.union([z.number().min(0).max(100), z.null()]).optional().transform((v) => v ?? null),
    quality_breakdown: z.union([qualityBreakdownSchema, z.null()]).optional().transform((v) => v ?? null),
    exclusion_flags: z.array(z.enum(EXCLUSION_FLAGS)).optional().transform((v) => v ?? []),

    // [R2-N2] Giá trị lạ là CẢNH BÁO, không phải lỗi cứng (§19.1), nên không dùng enum ở
    // đây — `collectWarnings()` lo phần đó. Giữ nguyên giá trị thay vì lọc bỏ: lọc im lặng
    // làm mất dữ liệu mà không ai biết.
    animal_stage: z.union([z.array(z.string()), z.null()]).optional().transform((v) => v ?? null),
    software_module: z.union([z.string(), z.null()]).optional().transform((v) => v ?? null),
    source_bias: z.union([z.literal('commercial'), z.null()]).optional().transform((v) => v ?? null),
    // `tags` sai hình dạng là CẢNH BÁO (§8.1), nên không validate cứng ở đây.
    tags: z.unknown().optional(),
  });

  return base.superRefine((fm, ctx) => {
    if (fm.publication_date > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publication_date'],
        message: `publication_date=${fm.publication_date} ở TƯƠNG LAI so với ${today} — không hợp lệ (Ch.9 "tính cập nhật").`,
      });
    }
    if (fm.last_reviewed > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['last_reviewed'],
        message: `last_reviewed=${fm.last_reviewed} ở TƯƠNG LAI so với ${today} — không hợp lệ (Ch.9 "tính cập nhật").`,
      });
    }
    if (fm.valid_from !== null && fm.valid_to !== null && fm.valid_to <= fm.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_to'],
        message: `valid_to=${fm.valid_to} phải sau valid_from=${fm.valid_from}.`,
      });
    }
    if (fm.translated_language !== null && fm.translated_language === fm.language) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['translated_language'],
        message:
          `translated_language=${fm.translated_language} trùng language — bản dịch phải khác ` +
          'ngôn ngữ bản gốc, nếu không thì liên kết bản gốc ↔ bản dịch không nói gì (Ch.3, Ch.8).',
      });
    }
    for (const err of enforceChapter9(fm)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [err.field], message: err.message });
    }
  });
}

export type FrontmatterSchema = ReturnType<typeof buildFrontmatterSchema>;
export type Frontmatter = z.infer<FrontmatterSchema>;

/** Chuyển lỗi zod thành `KbIssue` theo đúng khuôn `file:field: lý do` của §9.1 bước 2. */
export function zodIssuesToKbIssues(file: string, error: z.ZodError): KbIssue[] {
  return error.issues.map((issue) => ({
    level: 'error' as const,
    file,
    field: issue.path.length > 0 ? issue.path.join('.') : '(frontmatter)',
    message: issue.message,
  }));
}

// ──────────────────────────── §7.0 đối chiếu đường dẫn ────────────────────────────

/** Thư mục chứa file, tính từ `knowledge/`, luôn dùng `/`. Rỗng nếu file nằm ngay gốc. */
export function dirKeyOf(relPath: string): string {
  const norm = relPath.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '' : norm.slice(0, idx);
}

export function lookupTaxonomy(dirKey: string): TaxonomyEntry | null {
  const table = PATH_TAXONOMY as Record<string, TaxonomyEntry>;
  return Object.prototype.hasOwnProperty.call(table, dirKey) ? table[dirKey] : null;
}

export function isPathCheckExempt(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  return PATH_CHECK_EXEMPT.some((dir) => norm === dir || norm.startsWith(`${dir}/`));
}

/**
 * Đối chiếu vị trí file với frontmatter (§9.1 bước 3).
 *
 * `07_Archived_Superseded/` được miễn bước này NHƯNG phải thoả ràng buộc bù: `valid_to` đã
 * qua HOẶC `superseded_by != null`. `category`/`domain` của file đó lấy từ frontmatter (đã
 * validate enum), chỉ bỏ bước so với đường dẫn.
 */
export function checkPathTaxonomy(args: {
  relPath: string;
  fm: Pick<Frontmatter, 'domain' | 'category' | 'doc_kind' | 'valid_to' | 'superseded_by'>;
  now: Date;
}): KbIssue[] {
  const { relPath, fm, now } = args;
  const file = relPath.replace(/\\/g, '/');
  const today = now.toISOString().slice(0, 10);

  if (isPathCheckExempt(file)) {
    const expired = fm.valid_to !== null && fm.valid_to < today;
    if (!expired && fm.superseded_by === null) {
      return [{
        level: 'error',
        file,
        field: 'path',
        message:
          `nằm trong ${PATH_CHECK_EXEMPT[0]}/ nên được miễn đối chiếu đường dẫn, nhưng phải ` +
          'thoả ràng buộc bù: valid_to đã qua HOẶC superseded_by != null. Hiện không thoả cả hai, ' +
          'tức thư mục này đang bị dùng làm chỗ lách kiểm tra taxonomy (§7.0 hệ quả 3).',
      }];
    }
    return [];
  }

  const dirKey = dirKeyOf(file);
  const entry = lookupTaxonomy(dirKey);
  if (entry === null) {
    return [{
      level: 'error',
      file,
      field: 'path',
      message:
        `thư mục "${dirKey || '(gốc knowledge/)'}" KHÔNG có trong PATH_TAXONOMY. Không có nhánh ` +
        '"đoán từ frontmatter" — đoán chính là cách tài liệu lạc chỗ đi vào index. Hãy chuyển file ' +
        'về đúng thư mục, hoặc bổ sung thư mục này vào PATH_TAXONOMY trong lib/kb/schema.ts.',
    }];
  }

  const out: KbIssue[] = [];
  if (fm.domain !== entry.domain) {
    out.push({
      level: 'error', file, field: 'domain',
      message: `domain=${fm.domain} nhưng thư mục "${dirKey}" ứng với ${entry.domain} (PATH_TAXONOMY).`,
    });
  }
  if (fm.category !== entry.category) {
    out.push({
      level: 'error', file, field: 'category',
      message: `category=${fm.category} nhưng thư mục "${dirKey}" ứng với ${entry.category} (PATH_TAXONOMY).`,
    });
  }
  if (fm.doc_kind !== entry.doc_kind) {
    out.push({
      level: 'error', file, field: 'doc_kind',
      message: `doc_kind=${fm.doc_kind} nhưng thư mục "${dirKey}" ứng với ${entry.doc_kind} (PATH_TAXONOMY).`,
    });
  }
  return out;
}

// ─────────────────────── Quy tắc cần cả kho (R3-M11) ───────────────────────

export interface ParsedDoc {
  /** Đường dẫn tương đối tính từ `knowledge/`, dùng `/`. */
  relPath: string;
  fm: Frontmatter;
}

/**
 * `document_id` duy nhất toàn kho, `superseded_by`/`translation_of` phải trỏ tới tài liệu
 * TỒN TẠI. Chạy trên TOÀN BỘ tài liệu đã parse, kể cả `rejected`: một tài liệu bị thay thế
 * bởi một tài liệu `rejected` vẫn là một liên kết có thật, còn trỏ vào hư không thì không.
 */
export function checkCrossDocument(docs: readonly ParsedDoc[]): KbIssue[] {
  const out: KbIssue[] = [];
  const firstSeen = new Map<string, string>();

  for (const doc of docs) {
    const prev = firstSeen.get(doc.fm.document_id);
    if (prev !== undefined) {
      out.push({
        level: 'error', file: doc.relPath, field: 'document_id',
        message: `document_id=${doc.fm.document_id} bị TRÙNG với ${prev} — mã tài liệu phải duy nhất toàn kho.`,
      });
    } else {
      firstSeen.set(doc.fm.document_id, doc.relPath);
    }
  }

  const known = new Set(firstSeen.keys());
  for (const doc of docs) {
    if (doc.fm.superseded_by !== null && !known.has(doc.fm.superseded_by)) {
      out.push({
        level: 'error', file: doc.relPath, field: 'superseded_by',
        message:
          `superseded_by=${doc.fm.superseded_by} KHÔNG tồn tại trong kho. Tài liệu đang tự nhận là ` +
          'đã bị thay thế bởi một thứ không có, tức mất đường truy vết sang bản hiện hành.',
      });
    }
    if (doc.fm.translation_of !== null && !known.has(doc.fm.translation_of)) {
      out.push({
        level: 'error', file: doc.relPath, field: 'translation_of',
        message: `translation_of=${doc.fm.translation_of} KHÔNG tồn tại trong kho (Ch.3: lưu liên kết bản gốc ↔ bản dịch).`,
      });
    }
    if (doc.fm.superseded_by === doc.fm.document_id) {
      out.push({
        level: 'error', file: doc.relPath, field: 'superseded_by',
        message: 'superseded_by trỏ vào chính tài liệu này.',
      });
    }
  }
  return out;
}

/** Cảnh báo (không chặn ingest) — §8.1 cột "Khi sai" = Cảnh báo. */
export function collectWarnings(doc: ParsedDoc): KbIssue[] {
  const out: KbIssue[] = [];
  const { relPath, fm } = doc;

  if (fm.animal_stage !== null) {
    const allowed = new Set<string>(ANIMAL_STAGES);
    const unknown = fm.animal_stage.filter((s) => !allowed.has(s));
    if (unknown.length > 0) {
      out.push({
        level: 'warning', file: relPath, field: 'animal_stage',
        message:
          `giá trị không thuộc enum: ${unknown.join(', ')}. Giá trị lạ được GIỮ NGUYÊN trong index ` +
          `(lọc im lặng làm mất dữ liệu) nhưng bộ lọc theo giai đoạn sẽ không nhận ra. Enum: ${ANIMAL_STAGES.join(' | ')}.`,
      });
    }
  }

  if (fm.software_module !== null && fm.domain !== 'cloud_farm') {
    out.push({
      level: 'warning', file: relPath, field: 'software_module',
      message: `software_module chỉ có nghĩa với domain=cloud_farm, tài liệu này là ${fm.domain}.`,
    });
  }

  if (fm.tags !== undefined && fm.tags !== null) {
    const ok = Array.isArray(fm.tags) && fm.tags.every((t) => typeof t === 'string');
    if (!ok) {
      out.push({
        level: 'warning', file: relPath, field: 'tags',
        message: 'tags phải là mảng chuỗi — giá trị hiện tại bị bỏ qua.',
      });
    }
  }

  return out;
}

/** §8.1: thân tài liệu ≥ 50 ký tự sau khi bỏ frontmatter. */
export function checkBody(relPath: string, body: string): KbIssue[] {
  if (body.trim().length >= MIN_BODY_CHARS) return [];
  return [{
    level: 'error', file: relPath, field: 'body',
    message: `thân tài liệu chỉ có ${body.trim().length} ký tự, cần tối thiểu ${MIN_BODY_CHARS}.`,
  }];
}

/** Hai field metadata được dùng ở nhiều nơi nên tính một chỗ: tài liệu đã hết hiệu lực chưa. */
export function isExpired(
  fm: Pick<Frontmatter, 'valid_to' | 'superseded_by'>,
  now: Date,
): boolean {
  const today = now.toISOString().slice(0, 10);
  // [R3-M9] `superseded_by != null` được gộp vào cùng nhánh với `valid_to`: một tài liệu đã
  // bị thay thế KHÔNG BAO GIỜ được làm căn cứ hiện hành, dù `valid_to` còn trống.
  return (fm.valid_to !== null && fm.valid_to < today) || fm.superseded_by !== null;
}

/** Kiểu đã hẹp lại cho index: `animal_stage` được giữ nguyên giá trị, kể cả giá trị lạ. */
export function narrowAnimalStages(values: string[] | null): AnimalStage[] | null {
  return values as AnimalStage[] | null;
}

// ───────────────── R3-N6: schema cho hai file JSON do ingest sinh ─────────────────

/**
 * `data/glossary.json` — ĐỌC Ở ĐƯỜNG NÓNG mỗi lượt chat, nên nó cần schema thật chứ không
 * phải niềm tin. `match_keys` là 6 cột §7.4 ĐÃ CHUẨN HOÁ SẴN (bỏ dấu, hạ chữ): chuẩn hoá
 * lại mỗi request là việc lặp vô ích trên đường nóng.
 */
export const glossaryTermSchema = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
  abbr: z.string(),
  unit: z.string(),
  note: z.string(),
  group: z.string(),
  match_keys: z.array(z.string().min(1)).min(1),
});

export const glossaryFileSchema = z.object({
  version: z.literal(1),
  terms: z.array(glossaryTermSchema),
});

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
export type GlossaryFile = z.infer<typeof glossaryFileSchema>;

/** `knowledge/_sources/sources.yaml` — DANH MỤC nguồn (§7.2), không chứa nội dung. */
export const sourceEntrySchema = z.object({
  id: z.string().regex(/^SRC-\d{3}$/, 'id phải dạng SRC-001'),
  name: z.string().min(1),
  url: z.string().url(),
  owner: z.string().min(1),
  language: z.enum(['vi', 'en']),
  topics: z.array(z.string().min(1)).min(1),
  license_status: z.enum(LICENSE_STATUSES),
  priority: z.enum(['high', 'medium', 'low']),
  notes: z.string().min(1),
});

export const sourcesFileSchema = z.object({
  sources: z.array(sourceEntrySchema).min(1),
});

export type SourceEntry = z.infer<typeof sourceEntrySchema>;
