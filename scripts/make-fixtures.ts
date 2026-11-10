/**
 * `npm run fixtures` — sinh cặp fixture cho test tích hợp (design.md §6.5 [M19], §19.2).
 *
 * Hai điều phải giữ bằng mọi giá:
 *
 * 1. **TẤT ĐỊNH.** Chạy lại không được đổi một byte nào ở cả hai file. Có test chốt điều đó
 *    (so byte + so hash). Vì vậy `ingested_at` là HẰNG SỐ, không phải `new Date()`, và vector
 *    sinh bằng `mockEmbed()` của adapter mock chứ không bằng số ngẫu nhiên.
 * 2. **KHÔNG SỬA TAY.** Sửa `.json` bằng tay là chắc chắn lệch `vectors_sha256`, và khi đó mọi
 *    test tích hợp fail ngay ở kiểm tra #3 của §9.4 với một lý do không ai đoán được. Muốn
 *    đổi fixture thì sửa file này rồi chạy lại `npm run fixtures`.
 *
 * Fixture CỐ Ý chứa những thứ kho thật không có và không nên có:
 *
 * - tài liệu `approved` (kho thật chưa có tài liệu nào được chuyên gia duyệt, nên nhánh "có
 *   căn cứ approved" của guard thú y [H1] chỉ test được bằng fixture);
 * - tài liệu `rejected` (ingest loại nó từ bước 4 nên nó không bao giờ vào index thật — ở đây
 *   nó tồn tại để chứng minh `retrieve()` cũng không bao giờ trả nó ra, tức bất biến "rejected
 *   không bao giờ được truy xuất" có HAI lớp phòng thủ chứ không phải một);
 * - **chuỗi liều thuốc giả** trong hai chunk `PIG-07`. Đây là DỮ LIỆU KIỂM THỬ, không phải
 *   hướng dẫn thú y: nó tồn tại để chứng minh `dosageIsGrounded()` phân biệt được liều có
 *   trong tài liệu approved với liều do LLM tự sinh.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '@/lib/kb/chunk';
import { KB_SCHEMA_VERSION } from '@/lib/kb/schema';
import {
  MOCK_EMBEDDING_DIM, MOCK_EMBEDDING_ID, MOCK_EMBEDDING_MODEL, mockEmbed,
} from '@/lib/embedding/mock';
import type {
  Category, DocKind, Domain, IndexEmbeddingMeta, IndexStats, IndexedChunk, VerificationStatus,
} from '@/lib/kb/types';

/** Mốc thời gian CỐ ĐỊNH — `new Date()` ở đây sẽ phá tính tất định của fixture. */
export const FIXTURE_INGESTED_AT = '2026-11-05T00:00:00.000Z';
export const FIXTURE_INDEX_FILE = 'kb-index.fixture.json';
export const FIXTURE_VECTORS_FILE = 'kb-vectors.fixture.bin';

export interface KbIndexFile {
  schema_version: number;
  ingested_at: string;
  embedding: IndexEmbeddingMeta;
  stats: IndexStats;
  chunks: IndexedChunk[];
}

interface ChunkSpec {
  document_id: string;
  index: number;
  category: Category;
  doc_kind?: DocKind;
  domain?: Domain;
  title: string;
  heading_path: string;
  text: string;
  verification_status: VerificationStatus;
  reviewer?: string | null;
  valid_to?: string | null;
  superseded_by?: string | null;
  subcategory?: string | null;
}

function chunkOf(spec: ChunkSpec): IndexedChunk {
  const text = spec.text.trim();
  return {
    chunk_id: `${spec.document_id}#${String(spec.index).padStart(3, '0')}`,
    document_id: spec.document_id,
    domain: spec.domain ?? 'pig_farming',
    category: spec.category,
    subcategory: spec.subcategory ?? null,
    doc_kind: spec.doc_kind ?? 'general_guidance',
    title: spec.title,
    source: 'Fixture kiểm thử – không phải tài liệu kiến thức',
    source_url: null,
    language: 'vi',
    translated_language: null,
    translation_of: null,
    version: '1.0',
    publication_date: '2026-11-01',
    last_reviewed: '2026-11-01',
    valid_from: null,
    valid_to: spec.valid_to ?? null,
    superseded_by: spec.superseded_by ?? null,
    license_status: 'internal_draft',
    verification_status: spec.verification_status,
    reviewer: spec.reviewer ?? null,
    exclusion_flags: [],
    source_bias: null,
    animal_stage: null,
    software_module: null,
    heading_path: spec.heading_path,
    text,
    // Ước lượng token dùng đúng heuristic của `lib/util/tokens.ts` để fixture không nói một
    // con số mà phần còn lại của hệ thống không đồng ý.
    token_estimate: Math.max(1, Math.ceil(text.length / 3.5)),
    content_hash: sha256Hex(text),
  };
}

/**
 * Tám tài liệu, mỗi vai một dòng. Thứ tự KHÔNG ĐƯỢC đổi tuỳ ý: thứ tự này là thứ tự vector
 * trong `.bin`, nên đổi thứ tự là đổi cả hai file.
 */
function fixtureChunks(): IndexedChunk[] {
  return [
    // (1) approved PIG-07 CÓ mẫu liều — nhánh "có căn cứ" của [H1].
    chunkOf({
      document_id: 'PIG-VET-001',
      index: 0,
      category: 'PIG-07',
      subcategory: 'Phác đồ đã duyệt',
      title: 'Phác đồ kháng sinh đã được duyệt (fixture kiểm thử)',
      heading_path: 'Phác đồ đã duyệt > Liều dùng',
      verification_status: 'approved',
      reviewer: 'BS. Kiểm Thử (fixture)',
      text: `
Tài liệu fixture này mô phỏng một phác đồ ĐÃ ĐƯỢC CHUYÊN GIA DUYỆT, dùng để kiểm thử nhánh
"có căn cứ approved" của guard thú y. Với trường hợp tiêu chảy do vi khuẩn đã được bác sĩ thú
y xác định, phác đồ mẫu ghi: tiêm 15 mg/kg trong 3 ngày, theo dõi đáp ứng hằng ngày. Con số
trong câu trên là DỮ LIỆU KIỂM THỬ, không phải hướng dẫn điều trị cho đàn thật.
      `,
    }),
    // (2) approved PIG-09 KHÔNG liên quan thuốc — nhánh H1 phải CHẶN.
    chunkOf({
      document_id: 'PIG-BIO-001',
      index: 0,
      category: 'PIG-09',
      subcategory: 'Cách ly',
      title: 'Cách ly lợn mới nhập (fixture kiểm thử)',
      heading_path: 'Cách ly > Yêu cầu khu cách ly',
      verification_status: 'approved',
      reviewer: 'KS. Kiểm Thử (fixture)',
      text: `
Khu cách ly phải tách biệt về không khí, nước thải và đường đi lại với khu chăn nuôi chính.
Người chăm làm việc ở khu cách ly sau cùng trong ngày và không quay lại khu chính. Dụng cụ và
bảo hộ dùng riêng, không mang qua ranh giới. Tài liệu này ở trạng thái approved nhưng KHÔNG
liên quan tới thuốc: nó tồn tại để chứng minh rằng "có tài liệu approved trong ngữ cảnh" KHÔNG
đồng nghĩa với "có căn cứ để trả lời câu hỏi về liều".
      `,
    }),
    // (3) in_review PIG-05 — bên A của cặp mâu thuẫn.
    chunkOf({
      document_id: 'PIG-NUT-001',
      index: 0,
      category: 'PIG-05',
      subcategory: 'Nhu cầu dinh dưỡng',
      title: 'Nhu cầu dinh dưỡng theo giai đoạn (fixture kiểm thử)',
      heading_path: 'Nhu cầu dinh dưỡng > Giai đoạn nursery',
      verification_status: 'in_review',
      text: `
Khung tham chiếu nội bộ cho giai đoạn nursery là protein thô khoảng 20% trong vật chất khô,
kèm nguồn đạm dễ tiêu để lợn con tập ăn sau cai sữa. Ưu tiên của giai đoạn này là giữ lượng
ăn vào ổn định, không phải đẩy tốc độ tăng trọng lên mức cao nhất.
      `,
    }),
    // (4) in_review PIG-05 — bên B của cặp mâu thuẫn: CÙNG category, CÙNG heading_path.
    chunkOf({
      document_id: 'PIG-NUT-005',
      index: 0,
      category: 'PIG-05',
      subcategory: 'Nhu cầu dinh dưỡng',
      title: 'Nhu cầu dinh dưỡng giai đoạn nursery — bản tham chiếu thứ hai (fixture kiểm thử)',
      heading_path: 'Nhu cầu dinh dưỡng > Giai đoạn nursery',
      verification_status: 'in_review',
      text: `
Bản tham chiếu thứ hai nêu protein thô khoảng 17% trong vật chất khô cho giai đoạn nursery.
Hai con số không thể cùng đúng với cùng một đàn, và cả hai tài liệu đều còn hiệu lực, đều chờ
chuyên gia duyệt — đây là tình huống mà hệ thống phải nêu rõ mâu thuẫn thay vì chọn bừa.
      `,
    }),
    // (5) rejected — không bao giờ được xuất hiện trong kết quả truy xuất.
    chunkOf({
      document_id: 'PIG-DIS-001',
      index: 0,
      category: 'PIG-08',
      subcategory: 'Bệnh đường tiêu hoá',
      title: 'Ghi chép bệnh chưa rõ nguồn (fixture kiểm thử, đã bị từ chối)',
      heading_path: 'Bệnh đường tiêu hoá > Ghi chép',
      verification_status: 'rejected',
      text: `
Nội dung này ở trạng thái rejected vì không rõ nguồn và thiếu phiên bản. Nó nói về tiêu chảy ở
lợn con để có đủ từ khoá trùng với câu hỏi kiểm thử, nhờ đó ca test "rejected không bao giờ
được truy xuất" mới có thể thất bại nếu hệ thống sai — một ca test không thể thất bại thì
không chứng minh được gì.
      `,
    }),
    // (6) hết hiệu lực theo `valid_to`, kèm `superseded_by`.
    chunkOf({
      document_id: 'PIG-NUT-004',
      index: 0,
      category: 'PIG-05',
      subcategory: 'Nhu cầu dinh dưỡng',
      title: 'Nhu cầu dinh dưỡng theo giai đoạn — bản cũ (fixture kiểm thử)',
      heading_path: 'Nhu cầu dinh dưỡng > Giai đoạn nursery',
      verification_status: 'in_review',
      valid_to: '2026-11-03',
      superseded_by: 'PIG-NUT-001',
      text: `
Bản cũ của khung tham chiếu dinh dưỡng nursery, đã hết hiệu lực và đã bị thay thế. Chunk này
phải được TÍNH cosine (để đo mức liên quan) nhưng KHÔNG BAO GIỜ vào ngữ cảnh trả lời; nó chỉ
được phép xuất hiện trong danh sách tài liệu hết hiệu lực đã bị loại.
      `,
    }),
    // (7) [R3-M9] đã bị thay thế NHƯNG `valid_to: null` — ca mà vòng trước để lọt.
    chunkOf({
      document_id: 'PIG-NUT-006',
      index: 0,
      category: 'PIG-05',
      subcategory: 'Nhu cầu dinh dưỡng',
      title: 'Khung dinh dưỡng đã bị thay thế nhưng không ghi valid_to (fixture kiểm thử)',
      heading_path: 'Nhu cầu dinh dưỡng > Giai đoạn grower',
      verification_status: 'in_review',
      valid_to: null,
      superseded_by: 'PIG-NUT-001',
      text: `
Tài liệu này có superseded_by trỏ sang bản hiện hành nhưng KHÔNG ghi valid_to. Nếu hệ thống
chỉ coi "hết hiệu lực" là valid_to đã qua thì chunk này vào ngữ cảnh và được dẫn như căn cứ
hiện hành, dù cả vị trí lưu trữ lẫn metadata đều nói nó đã bị thay thế. Nó nói về protein thô
giai đoạn grower để thực sự cạnh tranh được với bản hiện hành trong xếp hạng.
      `,
    }),
    // (8) [R2-M9][R3-H2] in_review PIG-07 CÓ mẫu liều: không được dẫn khi đã từ chối vì an toàn.
    chunkOf({
      document_id: 'PIG-VET-002',
      index: 0,
      category: 'PIG-07',
      subcategory: 'Ghi chép điều trị',
      title: 'Ghi chép điều trị chờ duyệt (fixture kiểm thử)',
      heading_path: 'Ghi chép điều trị > Liều đã dùng',
      verification_status: 'in_review',
      text: `
Ghi chép nội bộ chờ duyệt, có chứa mẫu liều: tiêm 20 mg/kg trong 5 ngày. Vì tài liệu CHƯA được
duyệt, liều trong đó không phải căn cứ hợp lệ, và khi hệ thống từ chối câu hỏi vì an toàn thú y
thì document_id này KHÔNG được xuất hiện trong khối trích dẫn — trích dẫn nó cũng là một cách
đưa liều chưa duyệt tới người dùng.
      `,
    }),
  ];
}

function buildStats(chunks: readonly IndexedChunk[]): IndexStats {
  const byDomain: Record<Domain, number> = { pig_farming: 0, cloud_farm: 0 };
  const byStatus: Record<VerificationStatus, number> = { approved: 0, in_review: 0, rejected: 0 };
  const byCategory: Partial<Record<Category, number>> = {};
  const byDocKind: Record<DocKind, number> = {
    general_guidance: 0, internal_sop: 0, legal_regulation: 0,
  };
  const documents = new Set<string>();
  const expired = new Set<string>();

  for (const chunk of chunks) {
    byDomain[chunk.domain] += 1;
    byStatus[chunk.verification_status] += 1;
    byCategory[chunk.category] = (byCategory[chunk.category] ?? 0) + 1;
    byDocKind[chunk.doc_kind] += 1;
    documents.add(chunk.document_id);
    if (chunk.valid_to !== null || chunk.superseded_by !== null) expired.add(chunk.document_id);
  }

  return {
    files: documents.size,
    chunks: chunks.length,
    // Fixture GIỮ LẠI tài liệu rejected trong `chunks` (ingest thật thì loại ở bước 4), nên
    // `skipped` ở đây là 0 và `by_verification_status.rejected` lớn hơn 0. Đó là chủ đích.
    skipped: 0,
    by_domain: byDomain,
    by_verification_status: byStatus,
    by_category: byCategory,
    by_doc_kind: byDocKind,
    expired: expired.size,
    reused_vectors: 0,
    pii_policy: 'fail-on-pii',
  };
}

export interface BuiltFixtures {
  index: KbIndexFile;
  vectors: Float32Array;
  vectorsBuffer: Buffer;
  indexJson: string;
}

export function buildFixtures(): BuiltFixtures {
  const chunks = fixtureChunks();
  const dimension = MOCK_EMBEDDING_DIM;

  const vectors = new Float32Array(chunks.length * dimension);
  chunks.forEach((chunk, i) => {
    const vec = mockEmbed(chunk.text);
    if (vec.length !== dimension) {
      throw new Error(`Vector mock có ${vec.length} chiều, cần ${dimension}.`);
    }
    vectors.set(vec, i * dimension);
  });

  const vectorsBuffer = Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength);
  const index: KbIndexFile = {
    schema_version: KB_SCHEMA_VERSION,
    ingested_at: FIXTURE_INGESTED_AT,
    embedding: {
      provider: MOCK_EMBEDDING_ID,
      embedding_model: MOCK_EMBEDDING_MODEL,
      dimension,
      normalized: true,
      task_type_document: null,
      vectors_file: FIXTURE_VECTORS_FILE,
      vectors_bytes: vectorsBuffer.byteLength,
      vectors_sha256: createHash('sha256').update(vectorsBuffer).digest('hex'),
    },
    stats: buildStats(chunks),
    chunks,
  };

  return {
    index,
    vectors,
    vectorsBuffer,
    indexJson: `${JSON.stringify(index, null, 2)}\n`,
  };
}

export async function writeFixtures(outDir: string): Promise<{ indexPath: string; vectorsPath: string }> {
  const built = buildFixtures();
  await mkdir(outDir, { recursive: true });
  const indexPath = path.join(outDir, FIXTURE_INDEX_FILE);
  const vectorsPath = path.join(outDir, FIXTURE_VECTORS_FILE);
  // Ghi `.bin` trước: `vectors_sha256` trong JSON mô tả file đó, nên JSON là thứ xuất hiện
  // sau cùng — nếu lần chạy bị cắt giữa đường thì thiếu JSON (lỗi rõ) chứ không phải JSON
  // tồn tại với hash của một file chưa có.
  await writeFile(vectorsPath, built.vectorsBuffer);
  await writeFile(indexPath, built.indexJson, 'utf8');
  return { indexPath, vectorsPath };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = path.join(repoRoot, 'tests', 'fixtures');
  const { indexPath, vectorsPath } = await writeFixtures(outDir);
  const built = buildFixtures();
  console.log(`✔ Đã sinh fixture (tất định, mốc thời gian cố định ${FIXTURE_INGESTED_AT})`);
  console.log(`  ${indexPath}`);
  console.log(`  ${vectorsPath}`);
  console.log(
    `  ${built.index.stats.files} tài liệu / ${built.index.stats.chunks} chunk / ` +
    `${built.index.embedding.dimension} chiều / sha256 ${built.index.embedding.vectors_sha256.slice(0, 12)}…`,
  );
}

const isDirectRun = process.argv[1] !== undefined
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  void main();
}
