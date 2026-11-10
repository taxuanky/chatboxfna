# Môi trường dự án Cloud Farm Chatbot — sự thật đã xác minh

Tài liệu này ghi các dữ kiện **đã được kiểm chứng bằng cách chạy thật** trên máy này.
Đừng khám phá lại, đừng suy đoán, và đừng ghi đè các kết luận ở đây bằng ký ức về
tài liệu cũ. Nếu bạn thấy một dữ kiện ở đây có vẻ sai, hãy kiểm chứng rồi báo cho
orchestrator, đừng tự im lặng làm khác.

## Workspace

- Thư mục gốc: `d:\FARM`
- Đề án gốc (nguồn chân lý cho mọi yêu cầu nghiệp vụ): `d:\FARM\docs\de-an-chatbot-cloud-farm.txt`
- Tài liệu thiết kế / kế hoạch / xác minh: `d:\FARM\.agents\tasks\`
- Repo GitHub đích: `https://github.com/taxuanky/chatboxfna.git` (hiện **public**, đang rỗng)

## Shell: PowerShell trên Windows

Các lỗi đã thực sự xảy ra trong dự án này, đừng lặp lại:

- **Dùng `$env:LOCALAPPDATA`, KHÔNG dùng `%LOCALAPPDATA%`.** PowerShell không expand cú
  pháp `%VAR%` của cmd — nó thành chuỗi ký tự thuần. Một agent đã kết luận sai rằng
  "Git chưa được cài" chính vì lỗi này.
- **Dùng `;` để nối lệnh, không dùng `&&`.**
- **Thực thi script `.ps1` bị chặn.** `ExecutionPolicy` của máy này chặn `& .\script.ps1`.
  Phải gọi: `powershell -NoProfile -ExecutionPolicy Bypass -File "<đường dẫn>"`.
- Terminal ở máy này **echo lại lệnh rất nhiễu và có thể cắt lệnh dài**. Với lệnh phức
  tạp, hãy ghi ra file `.ps1` rồi chạy file đó, và cho script **ghi kết quả ra file log**
  rồi đọc file log — đừng dựa vào stdout.
- Lệnh thường trả `Exit Code: -1` **kể cả khi thành công**. Đừng dùng exit code của shell
  này làm bằng chứng thất bại; hãy kiểm tra kết quả thật (file đã tạo, nội dung log).

## Git

- **Git ĐÃ được cài**, phiên bản `2.56.0.windows.4`.
- Đường dẫn đầy đủ: `C:\Users\KyTaXuan\AppData\Local\Programs\Git\cmd\git.exe`
- **Git KHÔNG nằm trong PATH.** Phải gọi bằng đường dẫn đầy đủ.
- Credential helper `manager` (Git Credential Manager) đã bật ở mức hệ thống.
  Lần push đầu sẽ mở cửa sổ đăng nhập GitHub.

### Quy tắc git cho các bước workflow

**Các agent chạy trong workflow KHÔNG được chạy bất kỳ lệnh git nào** (không `init`,
`add`, `commit`, `status`, `push`). Orchestrator chịu trách nhiệm toàn bộ phần git.

Khi prompt của bạn yêu cầu "commit", hãy hiểu là: lưu file lên đĩa, rồi ghi một dòng mô tả
mốc vừa xong vào `d:\FARM\.agents\tasks\CHANGELOG-NO-GIT.md`.

## Gemini API — số liệu đo thật ngày 05/11/2026

### Xác thực

- Key truyền dạng **query param**: `?key=<KEY>` trên `https://generativelanguage.googleapis.com/v1beta/...`
- Header `Authorization: Bearer <key>` trả **401**. Không dùng Bearer.
- Key AI Studio hiện có dạng **`AQ.Ab8...`, dài 53 ký tự** — không còn là `AIza...` 39 ký tự.
  **Đừng viết regex ép tiền tố `AIza`**, sẽ từ chối key hợp lệ. Chỉ kiểm tra chuỗi không rỗng.

### Chat model — độ tin cậy đo qua 2 lần cách xa nhau

| Model | Kết quả |
|---|---|
| `gemini-3.5-flash` | **OK cả 2 lần** → model mặc định |
| `gemini-3.8-flash` | 503 cả 2 lần |
| `gemini-flash-latest` | 503 cả 2 lần |
| `gemini-2.5-flash` | **404** — key này không truy cập được |

503 lặp lại qua 2 lần đo cách xa nhau nghĩa là **quá tải thường xuyên trên hạn mức miễn
phí**, không phải nhiễu tạm thời. Retry với exponential backoff cho **cả 429 và 503** là
bắt buộc. Đừng đặt các model 503 làm lựa chọn đầu tiên.

### Embedding — và cái bẫy quan trọng nhất của dự án

Model: `gemini-embedding-001`, endpoint `:embedContent`, tham số `outputDimensionality`
**hoạt động**. Chuẩn L2 đo được của vector trả về:

| Số chiều yêu cầu | Số float trả về | **Chuẩn L2** |
|---|---|---|
| 768 | 768 | **0,592158** |
| 1536 | 1536 | **0,699158** |
| 3072 | 3072 | **1,000000** |

**Chỉ vector ở số chiều đầy đủ mới được chuẩn hóa về đơn vị.** Vector bị cắt chiều KHÔNG
có chuẩn 1 (đặc tính Matryoshka). Hệ quả bắt buộc:

- Phải **L2-normalize lại** vector sau khi nhận từ API — ở cả lúc ingest và lúc embed câu
  hỏi người dùng.
- Nếu bỏ bước này mà dùng dot product làm điểm tương đồng (giả định vector đơn vị), điểm
  số lệch có hệ thống và **RAG xếp hạng sai tài liệu**. Lỗi này không crash, không báo lỗi:
  chatbot vẫn trả lời trôi chảy nhưng trích dẫn sai nguồn.
- Trường `normalized` trong metadata index chỉ được ghi `true` **sau khi đã thực sự
  normalize và kiểm tra lại**, không ghi theo ý định.
- Không trộn hai cách tính: hoặc normalize rồi dùng dot product, hoặc luôn tính cosine đầy đủ.

### Chưa xác minh được

- `:streamGenerateContent?alt=sse` trả **503** lúc đo → chưa kết luận được endpoint
  đúng hay sai. Phải thử lại có backoff. Adapter **phải tự hạ xuống chế độ không streaming**
  nếu SSE lỗi, để UI không chết vì một tính năng trải nghiệm.

## Bảo mật — tuyệt đối

- **Không hard-code API key**, không ghi key vào bất kỳ file nào trong repo, không in key
  ra log hay báo cáo. Nếu cần debug, chỉ in 6 ký tự đầu.
- **Fixture trong test phải tự bịa hoàn toàn.** Không lấy bất kỳ ký tự nào của key thật,
  kể cả vài ký tự đầu, kể cả khi phần còn lại đã thay bằng số 0. Dạng key (`AQ.` đứng
  đầu, dài 53) là thông tin công khai và được phép dùng; các ký tự cụ thể của key thì
  không. Đã có một fixture vi phạm điều này và bị chặn ngay trước lúc commit.
- `.env.local` nằm trong `.gitignore` và **do orchestrator tạo**, các bước workflow chỉ
  tạo `.env.example` với placeholder.
- Repo đang **public**. Mọi thứ commit vào đây là công khai trên internet.
- Danh tính commit (orchestrator đặt ở phạm vi repo, không sửa config global):
  `user.name = taxuanky`, `user.email = taxuanky.ht@gmail.com`

## Ràng buộc nội dung từ đề án — không được vi phạm

Đây là yêu cầu cứng lấy từ chính tài liệu đề án, không phải sở thích:

- **Không bịa bất cứ thứ gì về Cloud Farm**: không tên menu, nút, trường dữ liệu, phân hệ,
  quy trình hay quyền người dùng (chương 2.2 và 14). Kho `knowledge/02_Cloud_Farm/` phải
  **rỗng nội dung** cho tới khi công ty cấp manual/SOP/FAQ thật.
- **Không crawl hay copy nội dung** từ Merck, PIC, Kansas State, WOAH, FAO vào repo.
  Phụ lục B của đề án yêu cầu kiểm tra điều khoản sử dụng trước. Chỉ lập **danh mục nguồn**
  có cấu trúc, không lấy nội dung.
- **Không tự đưa liều thuốc, phác đồ điều trị hay lịch vaccine** khi chưa có tài liệu đã
  được chuyên gia duyệt (chương 3 và 10). Phải có guard ở tầng code chặn việc này, bất kể
  LLM sinh ra gì.
- Tài liệu demo do agent tự soạn phải đánh `verification_status: in_review`, `reviewer: null`,
  và có cảnh báo rõ trong nội dung rằng đang chờ chuyên gia duyệt.
- **Không lấy câu trả lời do chatbot tự sinh làm đáp án chuẩn** cho bộ test (chương 11).
  Cột đáp án chuẩn để trống, chờ chuyên gia điền.

## Ngôn ngữ

Mọi nội dung hướng tới người dùng cuối — UI, thông báo lỗi, README, log người dùng đọc —
viết bằng **tiếng Việt**. Người dùng là nhân viên và quản lý trang trại.
