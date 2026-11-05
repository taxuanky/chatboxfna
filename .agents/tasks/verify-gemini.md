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
