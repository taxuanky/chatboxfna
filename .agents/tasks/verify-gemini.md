# Xác minh Gemini API — số liệu đo thật

> **Nguồn số đo: ORCHESTRATOR chạy thật ngày 05/11/2026** bằng API key của chủ sở hữu.
> Bước thiết kế (`design.md`) **KHÔNG** tự chạy các phép đo này — key không được cấp vào
> môi trường của bất kỳ bước workflow nào, có chủ ý, vì key hiện tại đã bị lộ trong khung
> chat và sẽ được chủ sở hữu thay.
>
> Không có giá trị key nào xuất hiện trong file này.

Endpoint gốc: `https://generativelanguage.googleapis.com/v1beta`

---

## 1. Xác thực — ✅ XONG

| Cách truyền key | Kết quả |
|---|---|
| Query param `?key=<KEY>` | **200 OK** — đây là cách dùng |
| Header `Authorization: Bearer <KEY>` | **401** — không dùng |

Định dạng key AI Studio hiện tại: **`AQ.Ab8...`, dài 53 ký tự**. Không còn là `AIza...`
39 ký tự như tài liệu cũ.

> **Hệ quả thiết kế:** validate biến môi trường **chỉ kiểm tra chuỗi không rỗng**
> (`z.string().min(1)`). Viết regex ép tiền tố `AIza` hoặc ép độ dài 39 sẽ **từ chối key
> hợp lệ**. Có unit test chốt cả hai định dạng `AQ.`-53 và `AIza`-39 đều pass.
> (design.md §6.1, §15.2)

---

## 2. Chat model — ✅ XONG (đo 2 lần, cách xa nhau)

Endpoint `v1beta/models/<model>:generateContent`, prompt tiếng Việt.

| Model | Lần 1 | Lần 2 | Kết luận |
|---|---|---|---|
| `gemini-3.5-flash` | OK | **OK** | ✅ **Model mặc định** |
| `gemini-3.8-flash` | 503 | **503** | Quá tải thường xuyên |
| `gemini-flash-latest` | 503 | **503** | Quá tải thường xuyên |
| `gemini-2.5-flash` | **404** | — | Key không truy cập được |

> **Hệ quả thiết kế:** 503 lặp lại ở **cùng các model qua hai lần đo cách xa nhau** nghĩa
> là quá tải thường xuyên trên hạn mức miễn phí, **không phải nhiễu tạm thời**. Vì vậy:
> - `GEMINI_MODEL=gemini-3.5-flash` là mặc định cứng — model duy nhất đáng tin hiện tại.
> - `GEMINI_FALLBACK_MODELS` **để trống mặc định**: một fallback gần như luôn thất bại chỉ
>   cộng thêm độ trễ trước khi hiện lỗi. Thay vào đó tăng retry trên model chính (4 lần).
> - Retry exponential backoff cho **cả 429 và 503** là **bắt buộc**, không tuỳ chọn.
> - `gemini-2.5-flash` **không** được đặt làm mặc định dù là tên quen tay — nó 404.
> (design.md §6.2)

---

## 3. Embedding — ✅ XONG — và đây là cái bẫy quan trọng nhất của dự án

Endpoint `v1beta/models/gemini-embedding-001:embedContent`. Tham số
`outputDimensionality` **hoạt động**.

| Số chiều yêu cầu | Số float trả về | **Chuẩn L2 đo được** |
|---|---|---|
| 768 | 768 | **0,592158** |
| 1536 | 1536 | **0,699158** |
| 3072 (mặc định) | 3072 | **1,000000** |

Cả `gemini-embedding-001` và `gemini-embedding-2` đều trả 3072 chiều ở chế độ mặc định.
Chọn `gemini-embedding-001` (bản ổn định, không phải preview).

> **Phát hiện then chốt:** chỉ vector ở **số chiều đầy đủ (3072)** mới được Google chuẩn
> hoá về đơn vị. Vector **bị cắt chiều KHÔNG có chuẩn 1** — đúng đặc tính Matryoshka, và
> lệch rất xa: 0,592 ở 768 chiều, tức sai khoảng **41%**.
>
> **Hệ quả nếu bỏ sót:** lấy vector 768 chiều rồi dùng **dot product** làm điểm tương đồng
> (cách tối ưu phổ biến vì người ta mặc định giả định vector là đơn vị) sẽ làm **điểm số
> lệch có hệ thống và RAG xếp hạng sai tài liệu**. Lỗi này **không crash, không có log,
> không ai phát hiện** — chatbot vẫn trả lời trôi chảy nhưng trích dẫn sai nguồn. Đây là
> rủi ro **đã được đo**, không phải suy đoán.

**Quyết định đã chốt trong thiết kế (chọn một, tuyệt đối không trộn lẫn):**

- ✅ **Phương án (i):** L2-normalize ở **tầng adapter**, ở **cả hai** đường (nhúng chunk lúc
  ingest **và** nhúng câu hỏi lúc query), rồi dùng **dot product**.
- ❌ Phương án (ii) bị loại: không normalize, luôn tính cosine đầy đủ `dot/(|a|·|b|)`.

Lý do chọn (i): nhanh hơn ở vòng lặp nóng (bỏ 2 căn bậc hai + 1 phép chia cho **mỗi** chunk
ở **mỗi** truy vấn), và quan trọng hơn — đặt bất biến ở **một chỗ duy nhất** thay vì bắt
mọi nơi tính điểm phải nhớ chia chuẩn. Với (ii), chỉ cần một chỗ quên là có bug im lặng.

Chuẩn hoá phải ở **tầng adapter chứ không phải tầng ingest**: nếu chỉ normalize lúc ingest
thì vector **câu hỏi** vẫn có chuẩn 0,592 và điểm số vẫn sai.

`EMBEDDING_DIMENSION=768` làm mặc định: 768 × 4 byte = **3 KB/chunk** ở dạng Float32 nhị
phân ⇒ 5.000 chunk chỉ ~15 MB, thoải mái để commit và deploy. Chất lượng theo bảng MTEB của
Google: 768 chiều đạt 67.99 vs 1536 đạt 68.17 — mất ~0,2 điểm để giảm 4 lần dung lượng.

(design.md §6.3)

---

## 4. Streaming SSE — ⚠️ CÒN TREO

| Hạng mục | Kết quả |
|---|---|
| `v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=…` | **503 Server Unavailable** |

503 là lỗi quá tải tạm thời, **không phải** lỗi quyền hay sai endpoint. Vì vậy **chưa kết
luận được** endpoint đúng hay sai.

**Việc còn lại cho bước implement:**

1. Thử lại endpoint SSE **nhiều lần có backoff** rồi mới kết luận — một lần 503 không
   chứng minh được gì.
2. Xác nhận hình dạng mảnh SSE thực tế: dòng `data: {...}`, text ở
   `candidates[0].content.parts[*].text`.
3. Ghi kết quả thật vào file này.

**Thiết kế đã phòng ngừa** (design.md §6.2.1): adapter thử SSE trước; nếu hết retry vẫn
không mở được stream và `GEMINI_ALLOW_NONSTREAM_FALLBACK=true` (mặc định) thì **tự hạ xuống
`:generateContent` không streaming**, nhận câu trả lời một lần rồi phát ra client theo đúng
giao thức NDJSON cũ. Client không cần nhánh xử lý riêng; chỉ có cờ
`{"type":"meta","streaming":false}` để UI hiện *"Đang trả lời…"* thay vì con trỏ gõ chữ.

Streaming là trải nghiệm tốt, **không phải điều kiện sống còn** — không để UI chết vì SSE lỗi.

---

## 5. Kiểm tra bắt buộc chạy thật ở bước implement

| # | Kiểm tra | Tiêu chí đạt |
|---|---|---|
| 1 | Chuẩn L2 của vector trong index đã ghi | Đọc ngẫu nhiên 5 vector từ `data/kb-vectors.bin`, tính `sqrt(Σv²)` → **= 1 ± 0,001** |
| 2 | `normalized: true` trong metadata index | Chỉ được ghi **sau khi** kiểm tra #1 đạt — không ghi theo ý định |
| 3 | Endpoint SSE | Theo mục 4 ở trên |
| 4 | Số chiều thực tế | `embedding.dimension` trong index khớp số float thật trả về, không khớp giá trị *yêu cầu* |

Kiểm tra #1 và #2 tồn tại vì ghi `normalized: true` mà không kiểm chính là cách bug chuẩn
hoá ở mục 3 lọt lưới.

---

## 6. Bốn giả định "CHƯA KIỂM" của §21.2 — ĐÃ KIỂM THẬT (FEAT-001, 06/11/2026)

> Nguồn: bước implement FEAT-001 chạy thật trên `node_modules` đã cài của chính repo này.
> Không dùng API key nào (các phép kiểm dưới đây không cần key).

### Phiên bản đã cài (`npm.cmd ls --depth=0`)

| Gói | Phiên bản |
|---|---|
| `next` | **15.5.29** |
| `react` / `react-dom` | 19.3.1 / 19.3.1 |
| `react-markdown` | **9.1.0** |
| `remark-gfm` | 4.0.1 |
| `zod` | 3.25.76 |
| `gray-matter` | 4.0.3 |
| `js-yaml` | 4.3.2 |
| `typescript` | 5.9.3 |
| `vitest` | 3.2.7 |
| `tsx` | 4.23.15 |
| `tailwindcss` | **3.4.19** (v3, KHÔNG phải v4) |
| `@tailwindcss/typography` | 0.5.20 |
| `postcss` / `autoprefixer` | 8.5.32 / 10.6.2 |
| `eslint` / `eslint-config-next` | 8.57.1 / 15.5.29 |
| `@types/node` | 20.19.43 |

Môi trường chạy: Node **v24.19.0**, npm **11.17.0**, đồng hồ máy **2026-11-06**.
(`engines.node` vẫn khai `>=20.9.0`, không ghim 24: Vercel Hobby chỉ cấp 20.x/22.x.)

### (i) `react-markdown@9` KHÔNG render raw HTML khi thiếu `rehype-raw` — ✅ ĐÚNG

Render thật bằng `react-dom/server#renderToStaticMarkup` với đầu vào có HTML thô:

```
Đầu vào:  Xin chào <img src=x onerror="alert(1)">
          <script>alert(2)</script>
          <b>đậm bằng HTML thô?</b>  + một bảng GFM

Đầu ra:   <p>Xin chào &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>
          &lt;script&gt;alert(2)&lt;/script&gt;
          <p>&lt;b&gt;đậm bằng HTML thô?&lt;/b&gt;</p>
          <table><thead>…</thead><tbody>…</tbody></table>
```

Đo được: chuỗi `<img` → **không có**; `<script` → **không có**; `<b>` → **không có**;
`<table>` → **có** (`remark-gfm` hoạt động). Chuỗi `onerror` chỉ còn tồn tại dưới dạng
**văn bản đã escape** (`onerror=&quot;`), không phải attribute.

> **Kết luận:** chống XSS mặc định là THẬT. **Tuyệt đối không thêm `rehype-raw`** — thêm nó
> là tự tay mở lại lỗ hổng này.

### (ii) `outputFileTracingIncludes` ở TOP-LEVEL `next.config.ts` của Next 15 — ✅ ĐÚNG

Ba phép kiểm độc lập trên Next 15.5.29:

1. `next/dist/server/config.js#loadConfig('phase-production-build', cwd)` trả về
   `outputFileTracingIncludes` **ở top-level** với đúng hai khoá `/api/chat` và
   `/api/health`; `experimental.outputFileTracingIncludes` là `undefined`.
   `output` = `"standalone"` được nhận đúng.
2. `next/dist/server/config-schema.js#configSchema.safeParse(...)`: top-level
   `outputFileTracingIncludes` ⇒ `success: true`; cùng khoá **gõ sai một chữ** ⇒
   `success: false`. Phép kiểm thứ hai chứng minh schema thật sự validate, nên kết quả
   thứ nhất không phải là "Next bỏ qua khoá lạ".
3. `npm.cmd run build` chạy xong (**exit 0**), không có cảnh báo
   `Invalid next.config.ts options detected`.

> Dòng `/api/health` là bắt buộc (R2-M10): mỗi function trên Vercel có bundle RIÊNG, thiếu
> nó thì `/api/health` báo `index.present=false` trên đúng bản deploy mà `/api/chat` chạy
> bình thường.

### (iii) `NextRequest.ip` đã bị bỏ ở Next 15 — ✅ ĐÚNG (và `geo` cũng mất)

Dựng `new NextRequest(url, { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } })`:

| Phép kiểm | Kết quả |
|---|---|
| `'ip' in req` | **false** |
| `req.ip` | **undefined** |
| `'geo' in req` | **false** |
| `req.headers.get('x-forwarded-for')` | `"203.0.113.9, 10.0.0.1"` — đọc được bình thường |
| `node_modules/next/dist/server/web/spec-extension/request.d.ts` | không còn khai báo `ip`; chỉ còn `cookies`, `nextUrl`, `page` (deprecated), `ua` (deprecated), `url` |

> **Kết luận:** cách lấy IP duy nhất là đọc header `x-forwarded-for`, nên thiết kế §13.4 là
> đúng và quyết định M13 (`TRUSTED_PROXY` + backstop toàn cục khi không tin header) vẫn
> giữ nguyên. API `Request` chuẩn **không** cho biết IP tầng giao vận, nên phương án
> "dùng IP kết nối thật" mà review vòng 2 đề xuất xác nhận là **không hiện thực được**.

### (iv) Trần `maxDuration` của Vercel Hobby — ⚠️ **KHÁC** giả định 60s: thực tế **300s**

Nguồn: [Vercel Functions limits](https://vercel.com/docs/functions/limitations) (đọc ngày
06/11/2026). Với Fluid compute (bật mặc định cho project mới), bảng thời lượng là:

| Gói | Mặc định | Tối đa | Tối đa mở rộng |
|---|---|---|---|
| **Hobby** | **300s** | **300s** | — |
| Pro / Enterprise | 300s | 800s | 1800s (beta) |

Mốc 60s của §21.2 là trần **cũ** của free tier — nó đến từ
[changelog 05/2024](https://vercel.com/changelog/vercel-functions-for-hobby-can-now-run-up-to-60-seconds)
("tăng từ 10s lên tối đa 60s"), và đã được thay bằng mặc định/trần 300s.
*Nội dung đã được diễn đạt lại để tuân thủ điều khoản sử dụng của nguồn.*

#### Quyết định: **DEADLINE_MS giữ 50 000 ms**, và route khai tường minh `maxDuration = 60`

Áp nguyên văn công thức "`DEADLINE_MS` = trần − 10s" sẽ cho **290 000 ms**. Không chọn, vì:

1. Trần 300s là **trần nền tảng**, còn `maxDuration` là **giá trị cấu hình được** của dự
   án. Giả định ngầm của công thức là "Hobby *ép* 60s nên phải lấy sát trần"; giả định đó
   không còn đúng, nên kết luận của nó cũng không còn hiệu lực.
2. `LLM_ATTEMPT_TIMEOUT_MS` có khoảng hợp lệ 5000–45000 với lý do ghi rõ ở §6.1 là
   *"45s + `RESERVE_MS` đã sát trần"* — câu đó chỉ đúng khi deadline tổng là 50s.
3. Với deadline 290s, `canRetry` **không bao giờ** chặn được gì (chuỗi 4 lần thử tối đa
   chỉ ~95s), tức toàn bộ cơ chế [M10] thành vô tác dụng, và một request trên hạn mức
   miễn phí được phép chạy tới 5 phút trong khi UX §14.2 ("chờ" / "gọi IT") được thiết kế
   để báo lỗi NHANH.

Đây là áp **quy tắc phân định số 3** (chọn phương án an toàn hơn) — ghi vào
`docs/MAPPING.md`. Hiện thực: hằng sống ở **một chỗ duy nhất** là
`lib/util/http.ts`:

```ts
export const VERCEL_MAX_DURATION_S = 60;   // route khai `export const maxDuration = 60`
export const DEADLINE_MS = 50_000;
if (DEADLINE_MS + 5_000 > VERCEL_MAX_DURATION_S * 1_000) throw new Error(...);
```

Assertion `DEADLINE_MS + 5s <= maxDuration*1000` chạy **lúc nạp module** (không phải lúc
request) và có unit test chốt. **Việc còn lại cho FEAT tạo `app/api/chat/route.ts`:** khai
`export const maxDuration = 60;` — thiếu dòng đó thì hàm nhận mặc định 300s của nền tảng và
hai con số không còn khớp nhau.

### Hạng mục §21.2 còn treo sau FEAT-001

| # | Hạng mục | Trạng thái |
|---|---|---|
| 4 | Endpoint `:streamGenerateContent?alt=sse` | ⚠️ **CÒN TREO** — cần key thật để thử lại có backoff. Đã có đường hạ cấp §6.2.1, đã test bằng mock: SSE 503 ⇒ tự gọi `:generateContent` và vẫn phát đúng chuỗi NDJSON với `meta.streaming === false`. |
| 9 | Heuristic `ceil(chars/3.5)` | ⚠️ **CHƯA ĐO** — cần `usageMetadata` của Gemini trên 10 chunk thật. Hằng khu trú ở `lib/util/tokens.ts#CHARS_PER_TOKEN`. |
| 5 / 1–2 ở mục 5 trên | Chuẩn L2 của vector trong index đã ghi | ⚠️ **CHƯA CHẠY ĐƯỢC** — chưa có `data/kb-index.json` (chưa ingest, và bước workflow không có key). Phải chạy trước khi ghi `normalized: true`. |
