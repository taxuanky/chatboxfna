/**
 * Quét dữ liệu cá nhân trong kho kiến thức — design.md §9.1 bước 7 [M6], Ch.10 quy tắc 7.
 *
 * Hợp đồng quan trọng nhất của file này: **chỉ trả về LOẠI và SỐ LẦN, không bao giờ trả về
 * GIÁ TRỊ.** In giá trị ra log hay báo cáo là tự rò rỉ đúng thứ đang bị chặn — và báo cáo
 * `data/ingest-report.json` thì được commit vào một repo đang PUBLIC.
 */

export type PiiKind = 'email' | 'phone_vn' | 'national_id' | 'api_key_like';

export interface PiiHit {
  kind: PiiKind;
  count: number;
}

/** Nhãn tiếng Việt để in trong báo cáo ingest. */
export const PII_LABELS: Record<PiiKind, string> = {
  email: 'địa chỉ email',
  phone_vn: 'số điện thoại Việt Nam',
  national_id: 'số CMND/CCCD',
  api_key_like: 'chuỗi trông như khoá API',
};

/**
 * Các mẫu được chọn để BẮT ĐƯỢC thứ cần bắt mà không báo động vì con số kỹ thuật thường
 * gặp trong tài liệu chăn nuôi ("21 ngày", "28 ngày tuổi", "FCR 2,5", "1.200 g").
 *
 * - `phone_vn`: 10 số bắt đầu bằng `0`, hoặc dạng `+84`/`84` + 9 số. Cho phép dấu cách,
 *   `.` và `-` làm ký tự phân nhóm vì người ta viết `0912 345 678`.
 * - `national_id`: đúng 9 hoặc 12 chữ số đứng riêng. Hai độ dài này là CMND và CCCD; các
 *   độ dài khác bị bỏ để không bắt mã lô, mã thiết bị hay số lượng.
 * - `api_key_like`: ba họ khoá đã gặp thật (`AIza…`, `AQ.…`, `sk-…`). Mẫu này tồn tại vì
 *   Ch.10 quy tắc 7 và vì repo đang public, không phải vì nghi ngờ ai.
 */
const PATTERNS: Array<{ kind: PiiKind; re: RegExp }> = [
  {
    kind: 'email',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    kind: 'phone_vn',
    re: /(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){9}(?![\d])/g,
  },
  {
    kind: 'national_id',
    re: /(?<![\d.,/-])(?:\d{9}|\d{12})(?![\d.,/-])/g,
  },
  {
    kind: 'api_key_like',
    re: /\b(?:AIza[\w-]{30,}|AQ\.[\w-]{20,}|sk-[A-Za-z0-9]{20,})\b/g,
  },
];

/** Trả về danh sách LOẠI PII kèm số lần, sắp theo loại để báo cáo tất định. */
export function scanPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const { kind, re } of PATTERNS) {
    const matches = text.match(new RegExp(re.source, re.flags));
    if (matches !== null && matches.length > 0) {
      hits.push({ kind, count: matches.length });
    }
  }
  return hits.sort((a, b) => a.kind.localeCompare(b.kind));
}

/** Dòng báo cáo một file: `<đường dẫn> : <loại> (n chỗ)`, KHÔNG có giá trị. */
export function formatPiiHits(relPath: string, hits: readonly PiiHit[]): string {
  const parts = hits.map((h) => `${PII_LABELS[h.kind]} (${h.count} chỗ)`);
  return `${relPath} : ${parts.join(', ')}`;
}
