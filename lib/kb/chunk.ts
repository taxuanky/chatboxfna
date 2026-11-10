/**
 * Cắt tài liệu thành chunk — design.md §9.2.
 *
 * Nguyên tắc: **heading trước, token sau**. Cắt máy móc theo độ dài làm câu trích dẫn chỉ
 * trỏ được tới cả tài liệu; cắt theo heading cho `heading_path` trỏ đúng tiểu mục, và đó là
 * thứ khối trích dẫn ở §16.2 cần.
 *
 * File này chỉ chạy lúc BUILD INDEX (`scripts/ingest.ts`, `scripts/make-fixtures.ts`), không
 * nằm trên đường nóng của request — nên dùng `node:crypto` cho sha256 là an toàn.
 */

import { createHash } from 'node:crypto';
import { estimateTokens } from '@/lib/util/tokens';

export interface ChunkOptions {
  maxTokens: number;
  minTokens: number;
  overlapTokens: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxTokens: 512,
  minTokens: 80,
  overlapTokens: 64,
};

export interface DocumentChunk {
  /** `<document_id>#<3 chữ số>`, ví dụ `PIG-NUT-001#002`. */
  chunk_id: string;
  /** Ví dụ `"Nhu cầu dinh dưỡng > Giai đoạn nursery"`; rỗng nếu nội dung nằm trước heading đầu. */
  heading_path: string;
  text: string;
  token_estimate: number;
  /** sha256(text) — phục vụ bước tái dùng vector của §9.1 bước 9. */
  content_hash: string;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ───────────────────────────────── Tách theo heading ─────────────────────────────────

interface Section {
  /** 0 = phần mở đầu trước heading đầu tiên; 2 = `##`; 3 = `###`. */
  level: number;
  headingPath: string;
  /** Các block đã tách theo đoạn (xem `splitBlocks`). */
  blocks: Block[];
}

interface Block {
  text: string;
  /** Bảng Markdown KHÔNG BAO GIỜ bị cắt đôi — bảng cắt đôi là vô dụng (Ch.9). */
  isTable: boolean;
  tokens: number;
}

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;

/**
 * Một block là một đoạn văn (ngăn bởi dòng trống), một bảng Markdown liền khối, hoặc một
 * khối code có fence. Bảng và code được nhận dạng để không bị tách ở bước chia theo token.
 */
function splitBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let buf: string[] = [];
  let bufIsTable = false;
  let inFence = false;

  const flush = (): void => {
    const text = buf.join('\n').replace(/\s+$/, '');
    buf = [];
    const wasTable = bufIsTable;
    bufIsTable = false;
    if (text.trim() === '') return;
    blocks.push({ text, isTable: wasTable, tokens: estimateTokens(text) });
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      buf.push(line);
      continue;
    }
    if (inFence) {
      buf.push(line);
      continue;
    }
    const isTableLine = /^\s*\|/.test(line);
    if (line.trim() === '') {
      flush();
      continue;
    }
    // Chuyển vào/ra khỏi bảng là một ranh giới block, để bảng luôn là một block trọn vẹn.
    if (buf.length > 0 && isTableLine !== bufIsTable) flush();
    if (buf.length === 0) bufIsTable = isTableLine;
    buf.push(line);
  }
  flush();
  return blocks;
}

function splitSections(body: string): Section[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const sections: Section[] = [];

  let level = 0;
  let h2 = '';
  let h3 = '';
  let buf: string[] = [];

  const push = (): void => {
    const blocks = splitBlocks(buf);
    buf = [];
    if (blocks.length === 0) return;
    const headingPath = level === 0 ? '' : level === 2 ? h2 : `${h2} > ${h3}`;
    sections.push({ level, headingPath, blocks });
  };

  for (const line of lines) {
    const m = HEADING_RE.exec(line);
    if (m === null) {
      buf.push(line);
      continue;
    }
    push();
    if (m[1].length === 2) {
      level = 2;
      h2 = m[2].trim();
      h3 = '';
    } else {
      level = 3;
      h3 = m[2].trim();
    }
  }
  push();
  return sections;
}

// ─────────────────────────────── Gộp section quá ngắn ───────────────────────────────

/**
 * Section < `minTokens` được gộp với section KẾ TIẾP CÙNG CẤP (§9.2), để không sinh chunk
 * vụn làm loãng điểm. `heading_path` giữ của section ĐẦU trong cặp gộp: đó là nơi người đọc
 * bắt đầu đoạn văn được dẫn.
 */
function mergeShortSections(sections: Section[], minTokens: number): Section[] {
  const out: Section[] = [];
  for (const section of sections) {
    const prev = out[out.length - 1];
    if (prev !== undefined) {
      const prevTokens = prev.blocks.reduce((sum, b) => sum + b.tokens, 0);
      if (prevTokens < minTokens && prev.level === section.level) {
        prev.blocks = [...prev.blocks, ...section.blocks];
        continue;
      }
      if (prev.level === 0) {
        // Phần mở đầu (trước heading đầu tiên) LUÔN được gộp xuôi vào section đầu tiên, kể
        // cả khi nó dài hơn `minTokens`. §9.2 định nghĩa chunk theo heading, nên nội dung
        // nằm trước heading đầu tiên không phải một section: để nó đứng riêng thì sinh một
        // chunk có `heading_path` RỖNG — một trích dẫn không trỏ được vào đâu. Cụ thể trong
        // kho này, khối cảnh báo "BẢN THẢO DEMO" nằm ngay dưới frontmatter của cả 15 tài
        // liệu, nên quy tắc "chỉ gộp khi ngắn" sẽ sinh 15 chunk giống nhau từng byte, không
        // mang nội dung kỹ thuật nào, mà vẫn dự thi xếp hạng.
        prev.blocks = [...prev.blocks, ...section.blocks];
        prev.level = section.level;
        prev.headingPath = section.headingPath;
        continue;
      }
    }
    out.push({ ...section, blocks: [...section.blocks] });
  }
  return out;
}

// ────────────────────────── Chia section vượt ngân sách token ──────────────────────────

/**
 * Chia theo RANH GIỚI ĐOẠN, với chồng lấn `overlapTokens` để câu bị cắt ngang vẫn còn ngữ
 * cảnh. Một block vượt hạn một mình (bảng lớn, khối code) được phát ra NGUYÊN VẸN và chunk
 * đó vượt mức — đúng tinh thần Ch.9 coi "OCR sai/mất bảng" là điều kiện loại trừ.
 */
function splitSectionByTokens(blocks: Block[], opts: ChunkOptions): string[] {
  const parts: string[] = [];
  let current: Block[] = [];
  let currentTokens = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    parts.push(current.map((b) => b.text).join('\n\n'));
    current = [];
    currentTokens = 0;
  };

  /** Phần đuôi mang sang chunk sau, trong hạn mức chồng lấn. Bảng KHÔNG bị mang sang. */
  const overlapTail = (used: Block[]): Block[] => {
    if (opts.overlapTokens <= 0) return [];
    const tail: Block[] = [];
    let tokens = 0;
    for (let i = used.length - 1; i >= 0; i -= 1) {
      const block = used[i];
      if (block.isTable) break;
      if (tokens + block.tokens > opts.overlapTokens) break;
      tail.unshift(block);
      tokens += block.tokens;
    }
    return tail;
  };

  for (const block of blocks) {
    if (currentTokens > 0 && currentTokens + block.tokens > opts.maxTokens) {
      const used = current;
      flush();
      current = overlapTail(used);
      currentTokens = current.reduce((sum, b) => sum + b.tokens, 0);
    }
    current.push(block);
    currentTokens += block.tokens;
    // Một block đơn lẻ đã vượt hạn: phát ra ngay, không có cách nào chia mà không phá block.
    if (currentTokens > opts.maxTokens && current.length === 1) flush();
  }
  flush();
  return parts;
}

// ──────────────────────────────────── Điểm vào ────────────────────────────────────

/**
 * `body` là thân tài liệu SAU KHI đã bỏ frontmatter.
 *
 * Kết quả TẤT ĐỊNH: cùng đầu vào cho cùng danh sách `chunk_id` và cùng `content_hash`, vì
 * `scripts/make-fixtures.ts` và bước tái dùng vector của ingest đều dựa vào điều đó.
 */
export function chunkDocument(
  documentId: string,
  body: string,
  options: Partial<ChunkOptions> = {},
): DocumentChunk[] {
  const opts: ChunkOptions = { ...DEFAULT_CHUNK_OPTIONS, ...options };
  const sections = mergeShortSections(splitSections(body), opts.minTokens);

  const chunks: DocumentChunk[] = [];
  for (const section of sections) {
    for (const text of splitSectionByTokens(section.blocks, opts)) {
      const index = chunks.length;
      chunks.push({
        chunk_id: `${documentId}#${String(index).padStart(3, '0')}`,
        heading_path: section.headingPath,
        text,
        token_estimate: estimateTokens(text),
        content_hash: sha256Hex(text),
      });
    }
  }
  return chunks;
}
