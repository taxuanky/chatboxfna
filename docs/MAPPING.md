# Truy vết yêu cầu đề án → file/module

> **Trạng thái:** file này còn thiếu phần chính. Bảng truy vết đầy đủ (mỗi chương của
> `docs/de-an-chatbot-cloud-farm.txt` → file/module hiện thực nó) thuộc **hạng mục 33** của
> `.agents/tasks/plan.md`; hạng mục đó sẽ **bổ sung vào file này**, không tạo file mới.
>
> Phần đã có bên dưới là **nhật ký quyết định phân định**. Quy tắc 3 của `plan.md §0` buộc
> mọi lần phải dùng quy tắc phân định đều ghi **quyết định + lý do** vào đây, nên nhật ký
> này được mở ngay từ hạng mục 1–8 thay vì đợi tới hạng mục 33.

---

## Nhật ký quyết định phân định

Mỗi dòng là một chỗ tài liệu tự mâu thuẫn hoặc một giả định đo ra khác dự kiến, đã phải
chọn. Thứ tự theo hạng mục.

### FEAT-001 (hạng mục 1–8)

#### 1. Trần `maxDuration` của Vercel Hobby là **300s**, không phải 60s ⇒ **giữ `DEADLINE_MS = 50_000`**

- **Mâu thuẫn:** `design.md §21.2` hạng mục 8 chỉ thị *"nếu khác 60s thì sửa đúng một hằng
  `DEADLINE_MS` (= trần − 10s)"*. Đo thật (tài liệu Vercel, 06/11/2026): Hobby với Fluid
  compute có mặc định **và** trần là **300s**. Áp nguyên văn ⇒ `DEADLINE_MS = 290_000`.
- **Quyết định:** **không** áp nguyên văn. Giữ `DEADLINE_MS = 50_000`, và route
  `/api/chat` khai tường minh `export const maxDuration = 60` (hợp lệ vì 60 ≤ 300).
  Hai hằng sống cạnh nhau ở `lib/util/http.ts` kèm assertion lúc nạp module.
- **Lý do (quy tắc 3 — chọn phương án an toàn hơn):** công thức "trần − 10s" giả định
  Hobby **ép** 60s nên phải lấy sát trần; giả định đó không còn đúng khi `maxDuration` là
  giá trị cấu hình được. Với deadline 290s: (a) `canRetry` không bao giờ chặn được gì vì
  chuỗi 4 lần thử tối đa chỉ ~95s, tức cơ chế [M10] thành vô tác dụng; (b) khoảng hợp lệ
  5000–45000 của `LLM_ATTEMPT_TIMEOUT_MS` mất căn cứ (§6.1 giải thích nó bằng câu *"45s +
  `RESERVE_MS` đã sát trần"*, chỉ đúng với deadline 50s); (c) một request trên hạn mức miễn
  phí được phép chạy tới 5 phút trong khi UX §14.2 được thiết kế để báo lỗi NHANH và phân
  biệt "chờ" / "gọi IT".
- **Số đo và nguồn:** `.agents/tasks/verify-gemini.md` mục 6 (iv).

#### 2. Adapter embedding Gemini gọi `:embedContent` **một lần cho mỗi văn bản**

- **Mâu thuẫn:** §6.2 nói *"embedding theo batch"*, còn §6.3 [N3] cảnh báo
  `gemini-embedding-2` **gộp nhiều input thành MỘT vector** và không báo lỗi nào — index
  hỏng âm thầm. Endpoint duy nhất đã đo thật trong dự án là `:embedContent` (một content,
  một vector); `:batchEmbedContents` **chưa đo**.
- **Quyết định:** `lib/embedding/gemini.ts#embedBatch` lặp qua từng văn bản, gọi
  `:embedContent` cho mỗi văn bản. Assertion cứng `vectors.length === texts.length` và
  "mọi vector cùng độ dài" **vẫn giữ** làm lưới an toàn.
- **Lý do (quy tắc 3):** cách này làm cái bẫy "N input → 1 vector" trở thành **không thể
  xảy ra về cấu trúc**, thay vì chỉ được phát hiện sau khi xảy ra. Đổi lại N request thay
  vì 1 — chấp nhận được ở quy mô demo (~95 chunk) và còn an toàn hơn với hạn mức miễn phí
  đã đo 429/503 thường xuyên. Adapter `openai-compatible` vẫn dùng batch thật (giao thức
  đó trả `data[]` có `index`), nên nhánh assertion độ dài có đường test thật ở đó.

#### 3. `LlmChatRequest.onMeta` — kênh báo `streaming: false` của đường hạ cấp §6.2.1

- **Khoảng trống:** §6.2.1 yêu cầu *"chỉ đặt `meta.streaming=false`"* khi adapter tự hạ
  xuống `:generateContent`, nhưng hợp đồng `LlmProvider.stream()` ở §5.3 chỉ trả
  `AsyncIterable<string>` — không có field nào chở được cờ đó.
- **Quyết định:** thêm `onMeta?: (meta: { streaming: boolean; model: string }) => void` vào
  `LlmChatRequest`; adapter gọi đúng một lần trước mảnh text đầu tiên.
- **Lý do:** `streaming` chỉ biết được SAU khi thử mở SSE nên nó là dữ liệu **của một
  lượt**. Giữ nó trong state của provider là đúng cái bẫy mà R3-M12 cảnh báo cho
  `deadline`: trên serverless hai request dùng chung instance thì lượt sau đọc được cờ của
  lượt trước. Callback giữ nguyên hợp đồng `AsyncIterable<string>` và không thêm trạng thái
  dùng chung.

#### 4. `eslint` + `eslint-config-next` được thêm vào `devDependencies`

- **Khoảng trống:** §3 và §4 yêu cầu script `"lint": "next lint"` nhưng không liệt kê
  eslint trong danh sách dependency.
- **Quyết định:** thêm `eslint@8` + `eslint-config-next@15` và `.eslintrc.json`
  (`extends: next/core-web-vitals`). Cả hai **không** nằm trong danh sách "tuyệt đối không
  thêm" của §3.
- **Lý do:** không có config, `next lint` chạy ở chế độ **hỏi tương tác** để chọn cấu hình
  và sẽ treo trong môi trường không có TTY — tức lệnh xác minh bắt buộc của dự án không
  chạy được. Ghi chú vận hành: `next lint` đã **deprecated** ở Next 15.5 và **bị bỏ** ở
  Next 16; khi nâng lên Next 16 phải chuyển sang ESLint CLI
  (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
