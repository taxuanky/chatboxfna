/**
 * Kiểu dữ liệu dùng chung toàn hệ thống — design.md §5.4 [M21].
 *
 * Mọi tên kiểu xuất hiện trong thiết kế được khai báo Ở MỘT CHỖ DUY NHẤT là file này.
 * Thêm một bản sao ở nơi khác là mở đường cho hai tầng hiểu khác nhau về cùng một field.
 */

export type Domain = 'pig_farming' | 'cloud_farm';

export type Category =
  | 'PIG-01' | 'PIG-02' | 'PIG-03' | 'PIG-04' | 'PIG-05' | 'PIG-06'
  | 'PIG-07' | 'PIG-08' | 'PIG-09' | 'PIG-10' | 'PIG-11' | 'PIG-12'
  | 'PIG-GLOSSARY'            // [H3] 04_Bilingual_Glossary
  | 'PIG-LEGAL'               // [H3] 03_Vietnam_Legal
  | 'CF-01' | 'CF-02' | 'CF-03' | 'CF-04' | 'CF-05';

/** [H3] Ch.10 quy tắc 6: phân biệt hướng dẫn chung / SOP nội bộ / quy định pháp luật */
export type DocKind = 'general_guidance' | 'internal_sop' | 'legal_regulation';

export type VerificationStatus = 'approved' | 'in_review' | 'rejected';

/** [R2-N2] Tập giá trị đóng, lấy từ Ch.2.1 và Ch.5.1 của đề án. */
export type AnimalStage =
  | 'nai_hau_bi' | 'nai_mang_thai' | 'nai_nuoi_con' | 'lon_con'
  | 'nursery' | 'grower' | 'finisher' | 'duc_giong';

export type ExclusionFlag =
  | 'unclear_source' | 'ocr_error_or_missing_tables' | 'missing_version_or_date'
  | 'conflicts_with_current_regulation' | 'unapproved_drug_or_dosage_guidance';

/** [H2] `partial_no_cf_docs`: trả lời phần chăn nuôi, từ chối riêng phần Cloud Farm. */
export type Grounding =
  | 'ok' | 'insufficient' | 'refused_vet_safety' | 'no_cf_docs' | 'partial_no_cf_docs';

export type RiskFlag =
  | 'dosage_intent'          // hỏi liều/phác đồ/vaccine (§12.3 lớp 1)
  | 'diagnosis_intent'       // hỏi chẩn đoán từ mô tả ngắn (Ch.10 q.3)
  | 'diagnosis_assertion'    // [M16] đầu ra khẳng định chẩn đoán → chèn cảnh báo
  | 'dosage_ungrounded'      // [H1] đầu ra có liều không truy ngược được → huỷ
  | 'cf_no_docs'             // [H2] đã tìm miền CF nhưng kho CF rỗng
  | 'conflict_detected';     // [M17] >= 2 tài liệu cùng chỗ nói khác nhau

export type Language = 'vi' | 'en';

/**
 * [R3-N2] `'refused'` dùng cho CẢ BA trạng thái tất định không gọi LLM
 * (`insufficient`, `no_cf_docs`, `refused_vet_safety`): `'stop'` nói sai vì không có gì
 * kết thúc bình thường, `'guard_abort'` cũng sai vì không có gì bị huỷ.
 * Quy ước kèm theo: `usage.chunks_used = 0` khi `finish_reason === 'refused'`.
 * `'guard_abort'` giữ RIÊNG cho trường hợp đã sinh rồi bị guard huỷ giữa dòng — eval và UI
 * phân biệt hai việc đó.
 */
export type FinishReason = 'stop' | 'length' | 'error' | 'aborted' | 'guard_abort' | 'refused';

/** Một chunk như được ghi trong data/kb-index.json (§9.3). */
export interface IndexedChunk {
  chunk_id: string;
  document_id: string;
  domain: Domain;
  category: Category;
  subcategory: string | null;
  doc_kind: DocKind;                        // [H3]
  title: string;
  source: string;
  source_url: string | null;
  language: Language;
  /** [R3-M11] ngôn ngữ của bản dịch kèm theo; phải KHÁC `language`. Ch.8 coi đây là
   *  metadata tối thiểu, và đây là cách Ch.3 "lưu bản gốc, bản dịch và liên kết" truy vết. */
  translated_language: Language | null;
  /** [R3-M11] `document_id` của bản gốc, khi tài liệu này là bản dịch. */
  translation_of: string | null;
  version: string;
  publication_date: string;
  last_reviewed: string;
  valid_from: string | null;
  valid_to: string | null;
  /** [R3-M9] tài liệu đã bị thay thế KHÔNG BAO GIỜ vào context: được gộp vào nhánh
   *  `expired` ở §11.2 bước 1, không phụ thuộc `valid_to`. */
  superseded_by: string | null;
  license_status: string;
  verification_status: VerificationStatus;
  reviewer: string | null;
  exclusion_flags: ExclusionFlag[];         // [H1] BẮT BUỘC có trong index
  source_bias: 'commercial' | null;
  animal_stage: AnimalStage[] | null;
  software_module: string | null;
  heading_path: string;
  text: string;
  token_estimate: number;
  content_hash: string;
}

export interface RankedChunk extends IndexedChunk {
  /** Dot product thuần, [-1, 1] — cổng liên quan áp lên đây [M8]. Hợp lệ vì mọi vector
   *  đã được L2-normalize ở TẦNG ADAPTER (bất biến #2). */
  cosine: number;
  /** cosine × status_multiplier × freshness_multiplier — CHỈ để xếp hạng trong một miền. */
  final_score: number;
  /** [R2-M5][R3-M9] `valid_to` đã qua `now`, HOẶC `superseded_by != null`. Chunk expired
   *  VẪN được tính cosine (để đo liên quan) nhưng KHÔNG BAO GIỜ vào context. */
  expired: boolean;
}

/** Một tên duy nhất cho khối trích dẫn. `CitationBrief` của vòng 1 bị bỏ. */
export interface CitationMeta {
  document_id: string;
  title: string;
  source: string;
  source_url: string | null;
  version: string;
  last_reviewed: string;
  verification_status: VerificationStatus;
  domain: Domain;
  category: Category;
  doc_kind: DocKind;
  heading_path: string;
  /** [R2-M5][R2-N4] cosine THUẦN của chunk được dẫn (KHÔNG nhân hệ số) — cùng đơn vị với
   *  `metrics.top_cosine`. Với mục trong `excluded_expired`: cosine cao nhất trong các
   *  chunk của tài liệu đó. */
  score: number;
  expired: boolean;
  valid_to: string | null;
  source_bias: 'commercial' | null;
  /** [R3-M11] để UI hiện "Bản dịch của {translation_of}". */
  translated_language: Language | null;
  translation_of: string | null;
  /** [R3-M9] để UI hiện "đã được thay thế bởi {superseded_by}". */
  superseded_by: string | null;
}

export interface RetrievalMetrics {
  /** Số chunk VÀO context (cả hai miền). */
  retrieved_count: number;
  /** [R2-M5] chỉ đếm chunk KHÔNG expired: đây là số ứng viên có thể làm căn cứ. */
  candidate_count: number;
  /** [R2-M5] cosine THUẦN cao nhất trong các chunk KHÔNG expired; 0 nếu không có. */
  top_cosine: number;
  /** [R3-M8] tổng của hai miền, mỗi miền tối đa 3 ⇒ trần 6. KHÔNG phải tổng số tài liệu
   *  hết hiệu lực trong kho. */
  excluded_expired_count: number;
  conflict_detected: boolean;               // [M17] quy tắc ở §11.2
  per_domain: Record<Domain, {
    retrieved: number;
    candidates: number;
    top_cosine: number;
    /** [R3-M8] số tài liệu hết hiệu lực đã qua cổng liên quan TRONG miền này, tối đa 3. */
    excluded_expired: number;
  }>;
}

export interface RetrievalResult {
  /** Đã lọc, xếp hạng và cắt ngân sách TRONG miền. */
  pig_farming: RankedChunk[];
  /** Đã lọc, xếp hạng và cắt ngân sách TRONG miền. */
  cloud_farm: RankedChunk[];
  /**
   * [R3-M8] Trần là THEO MIỀN (mỗi miền tối đa 3, sắp cosine giảm dần TRONG miền), không
   * trộn hai miền rồi sắp — trộn rồi sắp chính là phép so điểm giữa hai miền mà bất biến #7
   * cấm. Chỉ chứa tài liệu expired đã QUA cổng liên quan, dedupe theo `document_id`.
   */
  excluded_expired: Record<Domain, CitationMeta[]>;
  /** [H2][R3-H1] miền nào ĐÃ được tìm — guard Cloud Farm đọc field này. */
  searched_domains: Domain[];
  /** [M17] tín hiệu quan sát được để `npm run eval` chấm `expected_behavior`. */
  metrics: RetrievalMetrics;
}

/**
 * [R3-M1] Tập chunk THỰC SỰ vào prompt của lượt này: hợp hai miền SAU khi đã cắt ngân sách
 * (§11.3); chỉ dùng cho guard an toàn và dựng citations, KHÔNG dùng để xếp hạng.
 */
export type ContextChunks = RankedChunk[];

/**
 * [R3-M1] Hợp hai miền thành `ContextChunks` là ĐƯỢC PHÉP và không vi phạm bất biến #7, vì
 * không có phép so điểm nào giữa hai miền ở đây. Cấm duy nhất là SẮP XẾP hoặc CẮT trên
 * danh sách hợp này — mọi danh sách có thứ tự theo điểm đều phải thuộc MỘT miền.
 */
export function toContextChunks(r: RetrievalResult): ContextChunks {
  return [...r.pig_farming, ...r.cloud_farm];
}

export interface Notice {
  level: 'info' | 'warning';
  /**
   * [R3-M4] Đúng 5 mã. `COMMERCIAL_SOURCE` bị BỎ: Ch.14 yêu cầu "đánh dấu nguồn thương
   * mại", và cơ chế đúng cho việc đó là NHÃN trong khối trích dẫn (`CitationBlock`), không
   * phải một Notice — giữ nó trong enum tạo một giá trị không có điều kiện phát, không
   * test được.
   */
  code: 'IN_REVIEW_SOURCES' | 'EXPIRED_DOCS' | 'NO_CF_DOCS'
      | 'CONFLICT_DETECTED' | 'NOT_A_DIAGNOSIS';
  /** Tiếng Việt, sẵn sàng hiển thị. Component KHÔNG tự viết chuỗi Notice nào. */
  message: string;
}

export interface ChatMeta {
  request_id: string;
  domain: Domain | 'both';
  router_method: 'user' | 'lexical' | 'llm' | 'fallback' | 'llm_failed';
  searched_domains: Domain[];
  grounding: Grounding;
  risk_flags: RiskFlag[];
  /** [R2-H1] true ⇔ `mustBuffer` (§12.3): toàn bộ đầu ra được giữ ở server rồi mới phát. */
  delayed: boolean;
  /** false ⇔ đã hạ cấp khỏi SSE (§6.2.1). */
  streaming: boolean;
  /** Model thực sự trả lời. */
  model: string;
  metrics: RetrievalMetrics;                // [M17]
}

/** Metadata embedding ghi trong index — nguồn chân lý cho không gian vector [M11]. */
export interface IndexEmbeddingMeta {
  provider: 'gemini' | 'openai-compatible' | 'mock';
  embedding_model: string;
  dimension: number;
  /** Chỉ được ghi `true` SAU KHI đã thực sự normalize và ĐO LẠI chuẩn — không ghi theo ý định. */
  normalized: true;
  task_type_document: string | null;
  /** [R3-N3] tên file `.bin`; đường dẫn runtime = `path.join(path.dirname(KB_INDEX_PATH), vectors_file)`. */
  vectors_file: string;
  vectors_bytes: number;
  vectors_sha256: string;
}

/** [M21] Không throw lúc nạp index; phân biệt được 4 mã lỗi của §15.1. */
export type LoadResult =
  | { ok: true; index: LoadedIndex }
  | { ok: false;
      code: 'INDEX_MISSING' | 'INDEX_CORRUPT' | 'INDEX_PROVIDER_MISMATCH' | 'INDEX_SCHEMA';
      message: string };            // tiếng Việt, hiển thị được

export interface LoadedIndex {
  schema_version: number;
  ingested_at: string;
  embedding: IndexEmbeddingMeta;
  stats: IndexStats;
  chunks: IndexedChunk[];
  /** n_chunks × dimension, cùng thứ tự với `chunks[]`. */
  vectors: Float32Array;
}

export interface IndexStats {
  files: number;
  chunks: number;
  skipped: number;
  by_domain: Record<Domain, number>;
  by_verification_status: Record<VerificationStatus, number>;
  by_category: Partial<Record<Category, number>>;
  by_doc_kind: Record<DocKind, number>;
  expired: number;
  reused_vectors: number;
  /** 'fail-on-pii' | 'allow-pii: <lý do>'  [M6] */
  pii_policy: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** 0 khi `allowed`. */
  retryAfterSeconds: number;
  scope: 'ip' | 'global' | 'untrusted-shared';   // [M13]
}

/**
 * [M10][R3-M12] Ngữ cảnh một lượt request, truyền xuống MỌI lệnh gọi mạng.
 *
 * `deadline` là một CON SỐ, không phải `AbortSignal`: signal chỉ cho biết "đã hết giờ",
 * còn `lib/util/http.ts` cần biết "còn 1,2s nên đừng ngủ 8s rồi thử lại". `ctx` luôn là
 * THAM SỐ — biến module-scope sai trên serverless khi hai request dùng chung instance.
 */
export interface Ctx {
  requestId: string;
  /** epoch ms — hết hạn thì KHÔNG retry thêm (§6.2). */
  deadline: number;
  /** Nút "Dừng" của UI. */
  signal?: AbortSignal;
}
