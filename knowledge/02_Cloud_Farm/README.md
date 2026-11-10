> ## ⛔ ĐỌC TRƯỚC KHI ĐẶT BẤT KỲ FILE NÀO VÀO ĐÂY
>
> **Repo này đang ở chế độ PUBLIC.** Mọi file đặt vào thư mục này, sau khi commit và push,
> sẽ **công khai trên internet** cho bất kỳ ai đọc được.
>
> Tài liệu Cloud Farm là SOP nội bộ, ticket hỗ trợ và quy tắc nghiệp vụ của công ty.
> **Phải chuyển repo sang private — hoặc tách kho kiến thức ra khỏi repo công khai —
> TRƯỚC KHI thêm tài liệu thật đầu tiên.** Chuyển sau là không kịp: fork, clone, và
> cache của các dịch vụ bên thứ ba đã giữ bản sao mà ta không thu hồi được.
>
> Căn cứ: Ch.10 quy tắc 7 (không đưa dữ liệu không được phép vào kho kiến thức) và
> Ch.14 (rủi ro "Dữ liệu nhạy cảm trong ticket → rò rỉ thông tin").

# Kho tài liệu Cloud Farm — rỗng có chủ đích

Bảy thư mục con dưới đây đã được tạo đúng Phụ lục A của đề án, nhưng **không có một file
nội dung nào**. Đó là trạng thái đúng, không phải thiếu sót.

Đề án Ch.2.2 ghi rõ: *"chưa có tên nhà cung cấp hoặc bộ tài liệu Cloud Farm cụ thể trong đề
án. Vì vậy, không được tự tạo tên menu, chức năng, trường dữ liệu hay quy trình."* Ch.14 xếp
"Cloud Farm thiếu manual → chatbot bịa chức năng" là rủi ro chính của dự án.

Vì vậy: **chỉ nạp manual, SOP, FAQ và quy tắc nghiệp vụ THẬT do công ty hoặc nhà cung cấp
cấp.** Tuyệt đối không tự soạn nội dung mô phỏng để "có cái mà chạy thử" — một tài liệu tự
soạn về Cloud Farm sẽ được chatbot trích dẫn như căn cứ, và người dùng không có cách nào
phân biệt nó với tài liệu thật.

Hệ quả vận hành ở bản demo, đã được cưỡng chế bằng code: câu hỏi về Cloud Farm nhận câu trả
lời "chưa có tài liệu" kèm hướng dẫn liên hệ bộ phận phụ trách, và **không gọi LLM**. Câu hỏi
hỗn hợp được trả lời phần chăn nuôi và từ chối riêng phần Cloud Farm.

## Checklist tối thiểu để một tài liệu Cloud Farm được nạp

Trước khi đặt file vào đây, tài liệu phải có đủ:

1. **Phiên bản phần mềm** mà tài liệu mô tả (`version` trong frontmatter). Không có phiên bản
   thì không biết hướng dẫn còn đúng với bản đang dùng hay không.
2. **Người duyệt là key user** của phân hệ đó (`reviewer`), không phải người viết tài liệu.
3. **Ngày rà soát** (`last_reviewed`) và `valid_to` nếu nội dung gắn với một bản phần mềm cụ
   thể.
4. **Nguồn rõ ràng** (`source`): tên tài liệu gốc của công ty hoặc nhà cung cấp.
5. **Đã rà soát dữ liệu cá nhân**: ticket hỗ trợ thường chứa tên, số điện thoại, email của
   nhân viên. `npm run ingest` dừng cứng nếu phát hiện mẫu PII (Ch.10 quy tắc 7).
6. **`domain: cloud_farm`** và `category` khớp thư mục theo bảng `PATH_TAXONOMY` trong
   `lib/kb/schema.ts`.

## Ánh xạ thư mục → `category`

| Thư mục | `category` | `doc_kind` |
|---|---|---|
| `01_User_Guide/` | CF-01 | general_guidance |
| `02_SOP/` | CF-02 | internal_sop |
| `03_Training/` | CF-03 | general_guidance |
| `04_FAQ_Tickets/` | CF-04 | general_guidance |
| `05_Business_Rules/` | CF-05 | internal_sop |
| `06_Reports_KPI/` | CF-05 | internal_sop |
| `07_Troubleshooting/` | CF-04 | general_guidance |

Hai thư mục cuối có trong Phụ lục A nhưng không có mã riêng ở Ch.5.2, nên chúng dùng lại mã
gần nghĩa nhất: báo cáo/KPI là "cách tính KPI" (CF-05), troubleshooting là "lỗi thường gặp,
nguyên nhân và cách xử lý" (CF-04).
