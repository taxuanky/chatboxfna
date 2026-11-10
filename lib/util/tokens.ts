/**
 * Ước lượng token bằng heuristic — design.md §9.2, §11.4.
 *
 * Vì sao không dùng tiktoken: WASM nặng, làm chậm cold start trên serverless (§3), và bộ
 * tokenizer của Gemini không phải là bộ của OpenAI nên con số "chính xác" cũng chỉ là
 * chính xác cho nhà cung cấp khác.
 *
 * Hằng 3.5 ký tự/token: tiếng Việt viết bằng chữ Latin có dấu, một âm tiết thường là 3–5
 * ký tự và hiếm khi là một token trọn vẹn. Đây là ước lượng, và hướng sai số phải là ước
 * lượng CAO HƠN thực tế — ước lượng thấp hơn làm prompt vượt trần MỘT CÁCH IM LẶNG.
 * Hạng mục 9 của §21.2 còn treo: phải đo lại bằng `usageMetadata` của Gemini trên 10 chunk
 * thật; lệch > 20% thì sửa hằng này (và chỉ hằng này).
 */
export const CHARS_PER_TOKEN = 3.5;

/** Không bao giờ trả 0 cho chuỗi không rỗng. */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/**
 * [M9][R3-M13] Cắt một danh sách theo ngân sách token, BỎ PHẦN TỬ CŨ NHẤT TRƯỚC.
 *
 * Giữ phần tử mới nhất vì câu hỏi gần nhất là thứ cần để hiểu "còn giai đoạn sau thì sao?".
 *
 * Hàm này DÙNG CHUNG cho cả server (`lib/chat/pipeline.ts`) và client (`ChatShell`): client
 * phải cắt history bằng ĐÚNG hàm này trước khi gửi, nếu không hợp đồng 10 × 4000 ký tự của
 * §14.2 và trần body 64 KB của §14 sẽ cho hai kết quả khác nhau và người dùng nhận 400 với
 * thông báo nói sai nguyên nhân.
 */
export function trimByTokenBudget<T extends { content: string }>(items: T[], budget: number): T[] {
  if (budget <= 0) return [];
  const kept: T[] = [];
  let total = 0;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const cost = estimateTokens(item.content);
    if (total + cost > budget) break;
    total += cost;
    kept.push(item);
  }
  return kept.reverse();
}
