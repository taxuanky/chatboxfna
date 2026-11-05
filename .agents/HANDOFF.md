# Bàn giao trạng thái — Chatbot AI nội bộ Cloud Farm

Cập nhật: 05/11/2026, trước khi chủ sở hữu tắt máy.
File này để phiên làm việc hôm sau đọc và tiếp tục mà không phải dựng lại ngữ cảnh.

---

## 1. Yêu cầu gốc

Chủ sở hữu yêu cầu: *"viết 1 chát box như file đi kèm và cho phép tôi phát hành nó qua internet"*.

File đi kèm là đề án `docs/De_an_xay_dung_Chatbot_AI_noi_bo_Trang_trai_Cloud_Farm.docx`,
đã trích xuất sang `docs/de-an-chatbot-cloud-farm.txt` — **đây là nguồn chân lý cho mọi
yêu cầu nghiệp vụ**. Đề án mô tả chatbot nội bộ cho trang trại lợn, hai miền kiến thức
tách biệt (chăn nuôi lợn PIG-01..12, phần mềm Cloud Farm CF-01..05), kiến trúc RAG trước
fine-tuning sau, song ngữ VI/EN, bắt buộc trích dẫn nguồn, và 7 quy tắc trả lời an toàn
ở chương 10.

Nghĩa là công việc có **hai phần**: (a) xây chatbot, (b) đưa nó lên internet. Phần (b)
chưa làm.

---

## 2. Quyết định đã chốt với chủ sở hữu

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| Nhà cung cấp LLM | **Google Gemini** | key đã test thật, hoạt động |
| Chat model | `gemini-3.5-flash` | model duy nhất đáng tin, xem mục 4 |
| Embedding | `gemini-embedding-001`, 768 chiều | xem cái bẫy ở mục 4 |
| Stack | Next.js 15 App Router + TypeScript + Tailwind | deploy Vercel một lệnh |
| Nơi phát hành | **Vercel** | chưa làm, cần chủ sở hữu đăng nhập |
| Repo GitHub | `https://github.com/taxuanky/chatboxfna.git` | **PUBLIC** — xem mục 6 |
| Chế độ repo | **giữ public ở giai đoạn demo** | có điều kiện bắt buộc, mục 6 |
| Danh tính commit | `taxuanky` / `taxuanky.ht@gmail.com` | đặt ở phạm vi repo, config global vẫn rỗng |
| Git trong workflow | các bước workflow **không** chạy lệnh git | orchestrator sở hữu toàn bộ phần git |

---

## 3. Đã làm xong

- Đọc và trích xuất đề án từ `.docx`.
- Đo thật Gemini API bằng key của chủ sở hữu (mục 4).
- `git init` nhánh `main`, đặt danh tính ở phạm vi repo, thêm remote `origin`.
- Commit nền `84f095f` và **đã push thành công** lên GitHub, xác minh bằng cách đọc ngược
  ref từ remote: `84f095f8f06b19085445ff05803acd795b3e3bd3  refs/heads/main`.
- Tạo steering file `.kiro/steering/project-environment.md` để mọi agent trong workspace
  không khám phá lại môi trường.
- **Ba vòng thiết kế + hai vòng review thiết kế** đã hoàn tất:
  - `.agents/tasks/design.md` — 2.739 dòng, 22 mục
  - `.agents/tasks/design-review.md` + `design-review.json` — review vòng 2
  - `.agents/tasks/verify-gemini.md` — ghi lại số đo thật
  - `.agents/tasks/CHANGELOG-NO-GIT.md` — mốc công việc thay cho commit message

**Chưa có một dòng code ứng dụng nào.** Toàn bộ công việc tới giờ là tài liệu thiết kế.

---

## 4. Số đo Gemini thật — đừng đo lại, đừng suy đoán

Chi tiết đầy đủ nằm trong `.kiro/steering/project-environment.md`. Bản rút gọn:

- Xác thực bằng **query param `?key=`** trên `v1beta`. Header `Bearer` trả **401**.
- Key AI Studio nay có dạng **`AQ.Ab8...`, 53 ký tự** — không còn `AIza...`. Đừng viết
  regex ép tiền tố `AIza`.
- `gemini-3.5-flash` **OK cả 2 lần đo**. `gemini-3.8-flash` và `gemini-flash-latest`
  trả **503 cả 2 lần** cách xa nhau ⇒ quá tải thường xuyên, không phải nhiễu.
  `gemini-2.5-flash` trả **404** với key này.
- **Cái bẫy quan trọng nhất của dự án:** chuẩn L2 của vector embedding đo được là
  768 chiều → **0,592158** · 1536 chiều → **0,699158** · 3072 chiều → **1,000000**.
  Chỉ vector ở số chiều đầy đủ mới được chuẩn hóa. Vector cắt chiều **không** có chuẩn 1.
  Nếu bỏ bước chuẩn hóa lại mà dùng dot product, điểm số lệch có hệ thống và **RAG xếp
  hạng sai tài liệu** — không crash, không báo lỗi, chatbot vẫn trả lời trôi chảy nhưng
  trích dẫn sai nguồn.
- **Chưa xác minh được:** endpoint streaming `:streamGenerateContent?alt=sse` trả 503 lúc
  đo, chưa kết luận được. Thiết kế đã quy định adapter tự hạ xuống `generateContent`
  không streaming nếu SSE lỗi.

---

## 5. Trạng thái workflow khi tạm dừng

Workflow `wf_c1c86b8c87dea147` (`cloud-farm-chatbot-build`), **trạng thái: paused**.

```
[completed] setup
[paused]    design-loop            <-- vòng 3 / tối đa 3
   [completed] #0  design -> design-review  (CHANGES_REQUESTED: 4 HIGH, 17 MED, 4 NIT)
   [completed] #1  design -> design-review  (CHANGES_REQUESTED: 2 HIGH, 11 MED, 8 NIT)
   [paused]    #2  design (bản sửa vòng 3 ĐÃ ghi xong) -> design-review [chưa chạy]
[pending]   plan
[pending]   build-loop
[pending]   finalize
```

### RỦI RO CẦN BIẾT TRƯỚC

Vòng lặp thiết kế có `maxIterations: 3` và `onMaxIterations: "abort"`. Hiện đang ở
**vòng 3, tức vòng cuối**. Nếu review vòng 3 trả `CHANGES_REQUESTED` thì **cả workflow
sẽ abort**, không tự chuyển sang bước `plan`.

Số finding đang giảm dần (25 → 21) nhưng chưa về 0, nên khả năng abort là có thật.

**Kế hoạch xử lý nếu abort:** không chạy lại vòng thiết kế nữa. Thiết kế 2.739 dòng qua
3 vòng là đã quá đủ chi tiết cho một ứng dụng giai đoạn demo — tiếp tục lặp là sa vào
hoàn hảo hóa tài liệu thay vì làm ra sản phẩm. Thay vào đó: phóng một workflow mới bắt
đầu từ bước `plan`, dùng `design.md` hiện có, và **mang các finding HIGH chưa giải quyết
sang làm yêu cầu implement tường minh** chứ không bỏ chúng.

---

## 6. Chế độ repo — điều kiện bắt buộc, đừng bỏ qua

Chủ sở hữu chọn **giữ repo public**, lý do: giai đoạn này chỉ là chatbot hỏi đáp, chưa có
dữ liệu thật. Quyết định này hợp lý cho hiện trạng và **không phải lỗi thiết kế**.

Nhưng có một điều kiện cứng đi kèm, đã nói rõ với chủ sở hữu:

> Chuyển repo sang private về sau **không thu hồi được** những gì đã push lên public —
> fork, clone và cache của GitHub cùng các dịch vụ quét code đều đã có bản sao.
> Vì vậy mốc an toàn **không phải** "khi nào chạy thật", mà là **trước khi file tài liệu
> thật ĐẦU TIÊN được commit**. Quá mốc đó mới nhớ ra thì không sửa được.

Căn cứ từ chính đề án: chương 10 quy tắc 7 và chương 14 (rủi ro rò rỉ dữ liệu nhạy cảm
trong ticket hỗ trợ).

Để "tính tiếp sau" không chỉ là ý định, thiết kế đã được yêu cầu có hai cơ chế — bước
implement **phải** làm:

1. Cảnh báo đặt ở **điểm sử dụng**: đầu file `knowledge/02_Cloud_Farm/README.md`, là nơi
   người ta mở ra ngay trước khi bỏ manual/SOP/ticket thật vào. Không chỉ dựa vào README
   gốc của dự án, vì không ai đọc lại lần hai.
2. **Chốt chặn tự động** trong `npm run ingest`: nếu phát hiện file nội dung thật trong
   `knowledge/02_Cloud_Farm/`, in cảnh báo nhắc kiểm tra chế độ repo. Đúng thời điểm, vì
   ingest luôn phải chạy trước khi commit index.

Đã xác nhận bằng grep: thiết kế **không** có tính năng upload tài liệu qua UI, nên không
có đường rò rỉ tự động từ giao diện web.

---

## 7. Hai thay đổi repo mà bước implement phải làm

Cả hai đã nằm trong thiết kế, đã được review xác nhận:

1. **Bỏ `data/kb-index.json` khỏi `.gitignore`.** File index là build artifact được commit
   có chủ đích, vì Vercel build từ GitHub và không nên gọi API embedding lúc build.
   Hiện `.gitignore` **vẫn còn** dòng này — chưa sửa.
2. **Thêm `.gitattributes`** đánh file vector nhị phân là `binary`. Nếu không, Git trên
   Windows sẽ chuyển `0x0A` thành `0x0D 0x0A` trong file đó và **phá dữ liệu vector âm
   thầm** — cùng họ lỗi với cái bẫy chuẩn hóa L2.

---

## 8. Chủ sở hữu còn phải làm

1. **Thu hồi Gemini API key cũ.** Key đã bị dán vào khung chat nên coi như đã lộ.
   Vào `aistudio.google.com/apikey`, xóa key cũ, tạo key mới.
   **Đừng dán key mới vào chat** — dán vào `.env.local` (đã nằm trong `.gitignore`).
2. **Tạo `.env.local`** sau khi có code, theo đúng tên biến trong `.env.example`.
   Orchestrator tạo file này, các bước workflow chỉ tạo `.env.example` với placeholder.
3. **Đăng nhập Vercel** lúc deploy. Không tự động hóa được vì cần trình duyệt.

---

## 9. Môi trường — các bẫy đã mất thời gian vì chúng

Chi tiết trong `.kiro/steering/project-environment.md`. Ba thứ hay gây mất thời gian nhất:

- **PowerShell không expand `%VAR%`.** Phải dùng `$env:VAR`. Một agent đã kết luận sai
  "Git chưa được cài" chính vì lỗi này — Git **có** cài, ở
  `C:\Users\KyTaXuan\AppData\Local\Programs\Git\cmd\git.exe`, chỉ không nằm trong PATH.
- **ExecutionPolicy chặn `& .\script.ps1`.** Phải gọi
  `powershell -NoProfile -ExecutionPolicy Bypass -File "<path>"`.
- **Shell trả `Exit Code: -1` kể cả khi thành công** và echo lệnh rất nhiễu, có thể cắt
  lệnh dài. Với lệnh phức tạp: ghi ra file `.ps1`, cho script ghi kết quả ra file log,
  rồi đọc log. Đừng tin stdout, đừng tin exit code.

---

## 10. Cách tiếp tục hôm sau

1. Đọc file này và `.kiro/steering/project-environment.md`.
2. Kiểm tra `inspect_workflow` với id `wf_c1c86b8c87dea147` xem run còn sống không.
   - **Nếu còn và đang paused:** `update_workflow` status `running` để tiếp tục.
   - **Nếu không còn** (khả năng cao sau khi tắt máy): phóng workflow mới bắt đầu từ bước
     `plan`, dùng `design.md` hiện có làm đầu vào. Đừng chạy lại vòng thiết kế.
3. Nhớ mang theo: các finding HIGH chưa giải quyết của `design-review.json`, hai thay đổi
   repo ở mục 7, và hai cơ chế bảo vệ repo public ở mục 6.
4. Toàn bộ công việc còn lại: `plan` → `implement + code review` → `finalize` → `npm run
   ingest` với key thật → commit `data/` → push → deploy Vercel.
