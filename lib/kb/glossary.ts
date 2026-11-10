/**
 * Khớp thuật ngữ song ngữ — design.md §5.4 [M21], §7.4.
 *
 * Quy tắc khớp: `normalize('NFD')` → bỏ dấu phụ → `toLowerCase()` → khớp **theo biên từ**,
 * **ưu tiên cụm dài nhất**. Khớp chuỗi con tự do bị loại vì `"nái"` sẽ khớp bên trong
 * `"nái hậu bị"` và bên trong `"khoái"`, làm phình prompt bằng rác.
 *
 * `data/glossary.json` lưu sẵn `match_keys` đã chuẩn hoá, nên đường nóng chỉ còn việc
 * chuẩn hoá CÂU HỎI (một chuỗi) thay vì chuẩn hoá lại toàn bộ glossary mỗi request.
 */

import { readFile } from 'node:fs/promises';
import { glossaryFileSchema } from '@/lib/kb/schema';
import type { GlossaryFile, GlossaryTerm } from '@/lib/kb/schema';

export type { GlossaryFile, GlossaryTerm };

/** §7.4: tối đa 10 cặp VI/EN vào system prompt, để không phình token. */
export const GLOSSARY_MATCH_LIMIT = 10;

/**
 * Bỏ dấu + hạ chữ. Dùng cho CẢ thuật ngữ (lúc ingest) và câu hỏi (lúc chạy).
 *
 * Hai bước đầu đúng nguyên văn §5.4: `normalize('NFD')` rồi bỏ dải dấu phụ tổ hợp
 * `U+0300–U+036F`.
 *
 * Bước thứ ba là BỔ SUNG, và nó cần thiết: **`đ`/`Đ` (U+0111/U+0110) KHÔNG phải chữ cái cơ
 * sở cộng dấu phụ**, nên NFD không tách nó ra và hai bước trên để nguyên `đ`. Hệ quả đo được:
 * `"SỮA ĐẦU"` ra `"sua đau"`, nên người dùng gõ không dấu — `"sua dau"`, cách gõ phổ biến
 * nhất của nhân viên trại — KHÔNG khớp được mục `"sữa đầu"`, và `"tỷ lệ đẻ"` cũng vậy. Tức
 * là đúng mục đích mà bước bỏ dấu tồn tại để đạt thì lại không đạt được cho mọi thuật ngữ
 * có `đ`. Vì vậy ánh xạ `đ → d` trước khi so khớp.
 *
 * Đánh đổi đã nhận: `đ` và `d` nhập nhằng sau chuẩn hoá (`"đàn"` và `"dàn"` cùng ra `"dan"`).
 * Đây là cùng loại nhập nhằng mà bước bỏ dấu phụ đã chấp nhận từ đầu (`"dầu"` và `"dâu"`
 * cùng ra `"dau"`), và hậu quả xấu nhất là chèn thêm một cặp thuật ngữ không cần vào prompt —
 * không phải một lỗi an toàn.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Các khoá khớp của một mục: tiếng Việt, tiếng Anh và viết tắt (nếu có). */
export function buildMatchKeys(term: Pick<GlossaryTerm, 'vi' | 'en' | 'abbr'>): string[] {
  const keys = [term.vi, term.en, term.abbr]
    .map(normalizeForMatch)
    .filter((k) => k.length > 0);
  return [...new Set(keys)];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Biên từ tự viết thay vì `\b`: sau khi bỏ dấu, văn bản chỉ còn chữ Latin và chữ số, nên
 * "không phải [a-z0-9_]" là định nghĩa biên đúng và nó cho `"nai"` KHÔNG khớp trong
 * `"khoai"`. `\b` của JS cũng làm được việc đó nhưng sẽ sai với khoá kết thúc bằng ký tự
 * không phải chữ (ví dụ một viết tắt có dấu chấm).
 */
function matchKeyRegExp(key: string): RegExp {
  return new RegExp(`(?<![a-z0-9_])${escapeRegExp(key)}(?![a-z0-9_])`, 'g');
}

interface Candidate {
  key: string;
  term: GlossaryTerm;
}

/**
 * Trả về các mục glossary xuất hiện trong `text`, theo thứ tự xuất hiện, tối đa `limit`.
 *
 * Thuật toán: sắp khoá theo ĐỘ DÀI GIẢM DẦN, đánh dấu các khoảng đã khớp, và bỏ qua khoá
 * nào rơi vào khoảng đã khớp. Nhờ đó `"nái hậu bị"` thắng và KHÔNG trả thêm `"nái"`.
 */
export function matchGlossaryTerms(
  text: string,
  glossary: GlossaryFile,
  limit: number = GLOSSARY_MATCH_LIMIT,
): GlossaryTerm[] {
  if (limit <= 0) return [];
  const haystack = normalizeForMatch(text);
  if (haystack === '') return [];

  const candidates: Candidate[] = [];
  for (const term of glossary.terms) {
    for (const key of term.match_keys) candidates.push({ key, term });
  }
  // Cùng độ dài thì sắp theo khoá để kết quả TẤT ĐỊNH, không phụ thuộc thứ tự trong file.
  candidates.sort((a, b) => (b.key.length - a.key.length) || a.key.localeCompare(b.key));

  const taken: Array<{ start: number; end: number }> = [];
  const hits = new Map<GlossaryTerm, number>();

  for (const candidate of candidates) {
    const re = matchKeyRegExp(candidate.key);
    let m = re.exec(haystack);
    while (m !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = taken.some((range) => start < range.end && end > range.start);
      if (!overlaps) {
        taken.push({ start, end });
        const prev = hits.get(candidate.term);
        if (prev === undefined || start < prev) hits.set(candidate.term, start);
      }
      m = re.exec(haystack);
    }
  }

  return [...hits.entries()]
    .sort((a, b) => (a[1] - b[1]) || a[0].vi.localeCompare(b[0].vi))
    .slice(0, limit)
    .map(([term]) => term);
}

/** Nạp và validate `data/glossary.json`. Trả `null` khi chưa có file — không throw. */
export async function loadGlossaryFile(filePath: string): Promise<GlossaryFile | null> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
  const parsed = glossaryFileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// ─────────────────── Đọc bảng Markdown của knowledge/04_Bilingual_Glossary ───────────────────

/**
 * Trích 6 cột `Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm` từ bảng
 * Markdown của `glossary.md` để `scripts/ingest.ts` sinh `data/glossary.json`.
 *
 * Bỏ dòng tiêu đề và dòng phân cách; bỏ ô rỗng thành chuỗi rỗng (không phải `null`) để
 * schema ở §R3-N6 không cần nhánh nullable cho bốn cột mô tả.
 */
export function parseGlossaryMarkdown(markdown: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(trimmed)) continue;

    const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 6) continue;
    const [vi, en, abbr, unit, note, group] = cells;
    if (vi === '' || en === '') continue;
    if (/^tiếng việt$/i.test(vi)) continue;   // dòng tiêu đề

    terms.push({
      vi, en, abbr, unit, note, group,
      match_keys: buildMatchKeys({ vi, en, abbr }),
    });
  }
  return terms;
}
