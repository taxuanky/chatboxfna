# Review thiết kế — vòng 2

> Đối tượng review: `d:/FARM/.agents/tasks/design.md` (2.307 dòng, bản "vòng 2 — đã xử lý review").
> Nguồn chân lý nghiệp vụ: `d:/FARM/docs/de-an-chatbot-cloud-farm.txt` (Đề án v1.0, 11/2026).
> Người review đọc thiết kế **không mang theo ngữ cảnh của bước đã viết nó**: nếu tài liệu không tự đứng được thì chưa sẵn sàng để code.
> Không chạy build/test (chưa có code). Mọi dữ kiện trong mục "Giả định đã kiểm chứng" đều **chạy thật** trên máy này.

**Verdict: `CHANGES_REQUESTED`** — 2 HIGH, 11 MEDIUM, 8 NIT. HIGH/MEDIUM đều chặn.

Nhận định chung: thiết kế đã lên tới mức chi tiết triển khai được, và 25 finding của vòng 1 đều có dấu vết sửa thật trong văn bản (xem "Kiểm tra hồi quy vòng 1"). Các finding vòng 2 **không** lặp lại vòng 1; chúng là **lỗ hổng còn lại bên trong chính các bản sửa đó** (R2-H1, R2-H2, R2-M1, R2-M5, R2-M8) cộng với các chi tiết chưa đặc tả mà người implement buộc phải tự đoán (R2-M3, R2-M4, R2-M6, R2-M7).

---

## Giả định đã kiểm chứng (chạy thật trong vòng review này)

| # | Điều thiết kế khẳng định | Cách kiểm | Kết quả |
|---|---|---|---|
| 1 | Đồng hồ máy đích = `2026-11-05`, nên tài liệu mẫu `2026-11-01` không "ở tương lai" (§2, [H4]) | `Get-Date` | ✅ `2026-11-05`. Quy tắc ngày của §8.1 cho 12 tài liệu mẫu pass |
| 2 | Đề án **có** BOM `EF BB BF` (§12.1) | đọc 3 byte đầu | ✅ `EF BB BF` — bước `replace(/^\uFEFF/,'')` là cần thiết thật |
| 3 | Đề án "hiện chỉ có LF" (§12.1) | đếm CRLF/LF | ✅ 0 CRLF, 356 LF. `split(/\r?\n/)` đúng và chịu được cả CRLF |
| 4 | Trích xuất giữa 2 marker cho **đúng 7 dòng** (§12.1, [M15]) | chạy đúng quy trình §12.1 trên file thật | ✅ 7 dòng, dòng 231–237 (0-based: marker begin ở idx 230, end ở idx 238) |
| 5 | `CH10_SAFETY_RULES` khớp **từng ký tự** với đề án | so `-ceq` từng phần tử với dòng trích xuất, và `Contains` trên toàn văn | ✅ 7/7 khớp tuyệt đối, đúng thứ tự. Độ dài: 79 / 83 / 132 / 97 / 78 / 146 / 124 ký tự |
| 6 | Node v24.19.0, npm 11.17.0 (§2) | `node -v`, `npm -v` qua `cmd /c` | ✅ đúng cả hai |
| 7 | Git 2.56.0.windows.4 tại `%LOCALAPPDATA%\Programs\Git\cmd\git.exe`, không trong PATH (§2) | `Test-Path` + `--version` | ✅ đúng |
| 8 | `.gitignore` đang ignore `data/kb-index.json` kèm ghi chú "decision pending", **phải bỏ dòng đó** (§2, §9.3) | đọc `.gitignore` | ✅ dòng đó tồn tại đúng như mô tả. Việc sửa là bắt buộc, nếu không index sẽ không bao giờ lên GitHub và deploy Vercel sẽ 503 mọi câu hỏi |
| 9 | Mọi số đo Gemini trong §6.2/§6.3/§21.2 đến từ `verify-gemini.md` | đọc `verify-gemini.md` | ✅ khớp: `?key=` 200 / Bearer 401; `gemini-3.5-flash` OK×2, `gemini-3.8-flash` 503×2, `gemini-flash-latest` 503×2, `gemini-2.5-flash` 404; chuẩn L2 **0,592158 / 0,699158 / 1,000000**; SSE = 503 còn treo |
| 10 | Phụ lục B có 12 nguồn và §7.2 liệt kê đúng 12 | đối chiếu từng URL | ✅ khớp 12/12 (Merck ×3, PIC ×2, KSU, WOAH ×2, FAO, chinhphu, vbpl, FAOLEX) |
| 11 | §8 phủ **đủ** metadata tối thiểu Ch.8 | đối chiếu 9 nhóm field của Ch.8 | ✅ đủ; `document_id` regex `^(PIG\|CF)-[A-Z]{3,5}-\d{3}$` khớp cả 3 ví dụ của Ch.8 (`PIG-NUT-001`, `PIG-DIS-001`, `CF-GUIDE-001`) |
| 12 | §8.1 + `QUALITY-RUBRIC.md` encode đúng Ch.9 | đối chiếu trọng số và ngưỡng | ✅ 20/25/15/15/15/10 = 100; 85–100 / 70–84 / <70; 5 điều kiện loại trừ → 5 giá trị `exclusion_flags` |
| 13 | `PATH_TAXONOMY` phủ 23 thư mục (§7.0, §19.1) | đếm khoá trong bảng | ✅ 12 PIG + 7 CF + 3 Legal + 1 Glossary = 23 |
| 14 | Hai miền không trộn **ở mức kiểu dữ liệu** (§5.3) | đọc `RetrievalResult` | ✅ hai field riêng, không có mảng phẳng nào trong toàn bộ hợp đồng |
| 15 | Ch.11: 7 tiêu chí chấm tay có trong `--manual-template` (§18.2) | đối chiếu Ch.11 | ✅ đủ 7 |
| 16 | `expected_answer` luôn `null` + test chốt (§18.1) | đọc §18.1 | ✅ đúng Ch.11 *"Không lấy câu trả lời do chính chatbot tạo ra làm đáp án chuẩn"* |
| 17 | Kho `knowledge/02_Cloud_Farm/` rỗng nội dung, không có tên menu/chức năng nào bị bịa | đọc §7, §7.1, §7.3 và toàn bộ ví dụ | ✅ không tìm thấy bất kỳ tên menu/nút/trường/phân hệ Cloud Farm nào trong thiết kế |
| 18 | Không copy nội dung bản quyền: `sources.yaml` chỉ là **danh mục**, 12/12 `needs_review` | đọc §7.2 | ✅ đúng Ch.7 giai đoạn 1 và cảnh báo Phụ lục B |

---

## Giả định CHƯA kiểm chứng hoặc không kiểm được ở vòng này

Không có mục nào dưới đây **sai** theo bằng chứng hiện có; chúng chưa có bằng chứng, và bản thiết kế phải nói rõ điều đó ở đúng chỗ nó được dùng.

| # | Khẳng định | Trạng thái | Vì sao quan trọng |
|---|---|---|---|
| 1 | `maxDuration = 60` là trần của Vercel Hobby (§14) | **Chưa kiểm** (cần tài liệu Vercel hiện hành) | Toàn bộ `DEADLINE_MS = 50_000` + assertion `DEADLINE_MS + 5s <= maxDuration*1000` dựa vào con số này. Nếu Hobby khác 60s thì cả [M10] lệch. Phải xác nhận ở bước implement trước khi viết assertion |
| 2 | "Vercel Hobby chỉ cấp runtime 20.x/22.x nên ghim Node 24 sẽ fail build" (§4) | **Chưa kiểm** | Kết luận (`engines: >=20.9.0`) vẫn an toàn dù lý do đúng hay sai, nên không chặn |
| 3 | `:streamGenerateContent?alt=sse` đúng endpoint và hình dạng mảnh SSE | **Còn treo** (đo được 503) | Thiết kế đã tự nhận và có đường hạ cấp §6.2.1 — xử lý đúng, không chặn |
| 4 | `gemini-embedding-2` gộp nhiều input thành 1 vector; số MTEB 67.99/68.17 (§6.3, [N3]) | **Chưa đo**, đã dán nhãn "tài liệu Google" | Đã chặn bằng assertion `vectors.length === texts.length`; kết luận không phụ thuộc — xử lý đúng |
| 5 | `verify-gemini.md` ghi "cả `gemini-embedding-001` và `gemini-embedding-2` đều trả 3072 chiều" | **Ghi nhận của orchestrator**, không tái lập được ở vòng này (không có key) | §6.3 trình bày câu này như "đã đo thật". Chỉ `gemini-embedding-001` có bảng số đo chi tiết. Không chặn, nhưng đừng dựa vào nó cho quyết định nào |
| 6 | `npm.ps1` bị ExecutionPolicy chặn (§2) | **Chưa kiểm trực tiếp** (vòng này chạy npm qua `cmd /c`) | Khớp với steering của dự án; chỉ ảnh hưởng câu chữ README |
| 7 | "Brief của orchestrator ghi mặc định `openai-compatible`" và "brief yêu cầu 4–6 câu/nhóm test" (§6.1, §21.1 giả định 3 và 8) | **Không kiểm được** — brief không có trong repo | Hai lệch có chủ ý so với một tài liệu mà người implement không đọc được. Xem R2-N6 |
| 8 | Heuristic `ceil(chars/3.5)` ước lượng **cao hơn** thực tế cho tiếng Việt (§9.2) | **Chưa đo** | Mọi ngân sách token (§11.4) dựa vào nó. Sai số dưới mức ước lượng sẽ làm prompt vượt trần im lặng. Nên đo một lần bằng `usageMetadata` của Gemini ở bước implement |
| 9 | `react-markdown@9` không render raw HTML khi thiếu `rehype-raw`; `outputFileTracingIncludes` ở top-level Next 15; `NextRequest.ip` đã bị bỏ ở Next 15 (§3, §9.4, §13.4) | **Chưa kiểm offline** (chưa có `node_modules`) | Đều khớp với tài liệu các thư viện; ba điểm này là biên bảo mật/cấu hình nên cần xác nhận lúc `npm install` xong |

---

## Kiểm tra hồi quy vòng 1 (25 finding)

Đã đối chiếu từng finding của `design-review.json` vòng 1 với văn bản vòng 2.

- **Đã đóng, không còn dấu vết lỗi cũ (17):** H3, H4, M5, M6, M8, M9, M10, M12, M13, M14, M15, M16, M18, M19, M20, M21, N1, N2, N3, N4 — trong đó H4 đã nhất quán ngày `2026-11-01` ở cả §7.3, §8, §9.3, §9.5, §14.2; M15 đã được tôi **kiểm chạy thật** (mục "Giả định đã kiểm chứng" #4, #5) và quy trình trích xuất hoạt động đúng trên file thật.
- **Đã sửa nhưng còn lỗ hổng bên trong bản sửa (4):** H1 → R2-H1, R2-M3, R2-M4; H2 → R2-H2, R2-M8; M7 → R2-M7; M11 → R2-M1; M17 → R2-M5.
- **Sửa khác đề xuất, và cách khác là đúng (3):** M11 (index là nguồn chân lý thay vì so env), M13 (`NextRequest.ip` không còn tồn tại nên dùng bộ đếm dùng chung), M17 (`ask_for_more_data = insufficient && retrieved_count > 0` là điều kiện không bao giờ đúng). Ba lập luận này đều đứng vững khi đọc lại.

---

## Danh sách finding

### R2-H1 — HIGH — Hậu kiểm liều thuốc chỉ chạy cho câu hỏi đã bị gắn cờ, nên liều không có nguồn vẫn tới được người dùng

**Ở đâu:** §12.3 (đoạn "Vấn đề streaming và cách giải quyết" + "Lưu ý về phạm vi của `delayed`"), §15.1 (hai dòng hậu kiểm), §16.4; đối chiếu tuyên bố ở §1 *"an toàn thú y được cưỡng chế bằng code, không bằng prompt"*.

**Vấn đề.** `delayed` (và do đó cả khả năng **xoá** nội dung) chỉ bật khi `dosage_intent` bật, và §12.3 nói thẳng: *"chỉ `dosage_intent` làm hoãn stream, vì chỉ nhánh đó có thể phải xoá nội dung"*. Câu đó giả định rằng chỉ câu hỏi xin liều mới sinh ra liều trong đầu ra — giả định này sai. Danh sách phát hiện ý định ở lớp 1 là danh sách từ khoá (`liều`, `phác đồ`, `kháng sinh`, `vaccine`, `tiêm`, `điều trị`, `thuốc gì`…). Một câu hỏi rất thường gặp ở trại như *"lợn con tiêu chảy thì xử lý thế nào?"* khớp danh sách **chẩn đoán** (`tiêu chảy`) nhưng **không** khớp danh sách liều ⇒ `dosage_intent = false` ⇒ stream phát ngay, và `dosageIsGrounded()` theo đúng chữ của §12.3 không chạy. Nếu LLM tự thêm *"cho uống 5 ml điện giải, tiêm 15 mg/kg trong 3 ngày"* thì liều đó đi thẳng tới người dùng.

Mức độ nghiêm trọng bị nhân lên bởi chính thiết kế: kho demo **không có tài liệu `approved` nào** (§7.3), nên **mọi** con số liều trong đầu ra đều là liều không có nguồn theo định nghĩa của bất biến #5. Tức ở bản demo, lỗ hổng này không phải tình huống biên mà là tình huống thường.

**Sửa (cụ thể).** Tách "điều kiện hoãn stream" khỏi "điều kiện quét đầu ra": quét **luôn chạy**, hoãn thì chạy khi cần.

```ts
// lib/chat/pipeline.ts — quyết định TRƯỚC khi gọi LLM
const vetAdjacentContext = context.some(c =>
  c.category === 'PIG-07' || c.category === 'PIG-08' || findDosages(c.text).length > 0);

const mustBuffer =                       // buffer toàn bộ rồi mới phát
  riskFlags.includes('dosage_intent') ||
  riskFlags.includes('diagnosis_intent') ||
  vetAdjacentContext;
meta.delayed = mustBuffer;
```

1. **`mustBuffer = true`** → giữ nguyên hành vi hiện tại: buffer, `dosageIsGrounded()`, `guard_abort` nếu trượt.
2. **`mustBuffer = false`** → vẫn quét, nhưng quét **tăng dần có giữ lại đuôi**: chỉ phát phần văn bản cách đuôi buffer ≥ `HOLDBACK_CHARS = 200`; sau mỗi mảnh, chạy `findDosages()` trên phần **chưa phát + vừa phát cuối cùng**. Nếu xuất hiện một liều mà `dosageIsGrounded()` trả `false`: **dừng đọc stream LLM ngay**, phát `{"type":"error","code":"GUARD_ABORT","message":"<thông báo từ chối §12.2>"}` rồi `{"type":"done","finish_reason":"guard_abort"}`.
3. **Bổ sung quy tắc UI còn thiếu ở §16.4** (hiện chỉ mô tả ca `delayed`): khi nhận `finish_reason: 'guard_abort'`, client **xoá toàn bộ nội dung đã nhận của tin nhắn đó** và thay bằng `GroundingNotice` `refused_vet_safety`. Không giữ lại mảnh nào.
4. **Quét khẳng định chẩn đoán ([M16]) chuyển sang chạy KHÔNG điều kiện** cho mọi đầu ra. Nó chỉ **thêm** một `Notice` nên không cần buffer, và điều đó vá luôn lỗ tương tự: `diagnosis_intent` cũng là danh sách từ khoá và cũng bỏ sót (ví dụ *"FCR tụt, có phải do bệnh không?"*).
5. **Test chốt (thêm vào §19.2):** câu hỏi **không** gắn cờ (ví dụ *"lợn con tiêu chảy xử lý thế nào"*), mock phát `__MOCK_EMIT_DOSAGE__` giữa câu trả lời ⇒ **không có ký tự nào của chuỗi liều tới client**, `finish_reason === 'guard_abort'`, `risk_flags` chứa `dosage_ungrounded`.

---

### R2-H2 — HIGH — Router tầng 1 loại hẳn miền Cloud Farm khi `cfScore = 0`, nên chốt chặn CF (bản sửa H2 của vòng 1) không chạy

**Ở đâu:** §10 (quy tắc tầng 1 + nguồn sinh bảng từ khoá), §12.4 (điều kiện `searched_domains.includes('cloud_farm')`), §19.2 (hai ca test [H2]).

**Vấn đề.** Vòng 1 bị bắt lỗi vì guard chỉ chạy khi miền **là** `cloud_farm`; vòng 2 chuyển sang `searched_domains`, đúng hướng. Nhưng `searched_domains` do router quyết định, và quy tắc tầng 1 là:

> `max >= 2` và `max >= 2 × min` ⇒ miền thắng

Với `min = 0` thì `max >= 2 × 0` **luôn đúng**. Nên chỉ cần **một** từ khoá chăn nuôi trọng số 2 là miền Cloud Farm bị loại hoàn toàn.

Và `cfScore` gần như **luôn** bằng 0 với câu hỏi thật. §10 nói bảng từ khoá sinh từ ba nguồn: tên nhóm trong `PATH_TAXONOMY`, mục glossary, và `software_module` có trong index. Ở bản demo: `software_module` không tồn tại (kho CF rỗng), glossary §7.4 **toàn bộ là thuật ngữ chăn nuôi**, nên từ vựng CF chỉ còn tên thư mục/nhóm: *User Guide, SOP, Đào tạo, FAQ, Kiến thức chuyên gia, Reports KPI, Troubleshooting*. Không nhân viên nào gõ những chữ đó.

Hệ quả theo đúng chữ của thiết kế: *"xem FCR của đàn ở đâu trong phần mềm?"* → `FCR` là mục glossary (trọng số 2) ⇒ `pigScore = 2`, `cfScore = 0` ⇒ `method='lexical'`, `searched_domains = ['pig_farming']` ⇒ §12.4 **không chạy** ⇒ `grounding: 'ok'` ⇒ LLM được gọi để trả lời một câu hỏi phần mềm với context chăn nuôi, và lớp bảo vệ duy nhất còn lại là câu quy tắc 5 trong prompt — đúng thứ §1 nói không được coi là biên an toàn. Rủi ro Ch.14 *"Cloud Farm thiếu manual → Chatbot bịa chức năng"* quay lại qua một cửa khác.

Phụ thêm: ca test `[H2]` *"câu hỏi hỗn hợp, miền PIG có căn cứ ⇒ `partial_no_cf_docs`"* ở §19.2 **không có đường nào đạt được** với bảng từ khoá hiện tại, vì `partial` đòi `cfScore < pigScore` và `cfScore > 0` không bao giờ xảy ra.

**Sửa (cụ thể).** Ba thay đổi, cả ba đều tất định và không bịa tên chức năng Cloud Farm nào (chỉ dùng từ vựng phần mềm **chung**, nên không vi phạm Ch.2.2):

```ts
// lib/kb/router-domain.ts — từ vựng THAO TÁC PHẦN MỀM chung, trọng số 2, khớp cả không dấu.
// KHÔNG chứa tên menu/nút/trường/phân hệ nào của Cloud Farm (Ch.2.2, Ch.10 q.5).
export const CF_OPERATION_LEXICON = [
  'phần mềm','ứng dụng','app','hệ thống','màn hình','giao diện','menu','nút','tab','biểu mẫu',
  'đăng nhập','đăng xuất','tài khoản','mật khẩu','quyền','phân quyền','người dùng',
  'nhập liệu','nhập số liệu','sửa số liệu','xoá số liệu','ghi nhận','bản ghi','trường dữ liệu',
  'báo cáo','xuất báo cáo','xuất excel','lọc','tìm kiếm','thao tác','ở đâu trong',
  'không lưu được','báo lỗi','lỗi hệ thống','ticket','hỗ trợ kỹ thuật',
] as const;
```

1. **Không bao giờ loại một miền có điểm > 0.** Quy tắc tầng 1 mới:
   ```
   nếu min > 0            → domains = cả hai miền (không so tỉ lệ nữa)
   nếu min === 0 && max >= 4 → chỉ miền thắng          (tín hiệu một phía rất mạnh)
   nếu min === 0 && max >= 2 → chỉ miền thắng, NHƯNG nếu miền bị loại là cloud_farm
                               và index có 0 chunk cloud_farm thì vẫn thêm 'cloud_farm'
                               vào searched_domains (truy xuất trên kho rỗng tốn 0ms)
   còn lại                 → tầng 2 / 'both'
   ```
   Nhánh thứ ba bảo đảm §12.4 **luôn** được đánh giá khi kho CF rỗng, mà không phải tin vào chất lượng bảng từ khoá.
2. **Ghi `cfSignal` tường minh** để §12.4 phân biệt "đã tìm CF vì an toàn" với "người dùng thật sự hỏi CF": `cfSignal = cfScore > 0 || router.domains.includes('cloud_farm')`. Chỉ khi `cfSignal` mới phát `Notice` `NO_CF_DOCS` / từ chối (xem R2-M8).
3. **Sửa ca test §19.2** cho đúng đường đạt được: câu hỏi hỗn hợp phải chứa ít nhất một từ trong `CF_OPERATION_LEXICON` (ví dụ *"FCR tính thế nào và xem báo cáo FCR ở đâu trong phần mềm?"*), và thêm một ca mới: *"xem FCR ở đâu trong phần mềm"* ⇒ **không được** `grounding: 'ok'`.

---

### R2-M1 — MEDIUM — Bất biến #3 (§15.3) còn giữ nguyên quy tắc đã bị [M11] thay thế, và nó mâu thuẫn trực tiếp với một ca test

**Ở đâu:** §15.3 bất biến #3 ↔ §9.4 kiểm tra #5 ↔ §15.3 bất biến #13 ↔ §19.2 ca *"Index `dimension: 512` + env `EMBEDDING_DIMENSION=768` ⇒ vẫn chạy bình thường"*.

**Vấn đề.** Bất biến #3 vẫn ghi: *"Index và cấu hình embedding **cùng model, cùng số chiều**… Lệch mà không chặn thì không có exception… nên phải fail cứng"*, tầng cưỡng chế là `store.ts`. Nhưng §9.4 kiểm tra #5 đã **cố ý** thu hẹp còn so **provider**, và bất biến #13 nói model/dimension đọc **từ index**, không từ env. Bảng bất biến là nơi người implement coi là quy chuẩn; đọc bất biến #3 rồi thêm một so sánh `dimension` với env là hành vi hoàn toàn hợp lý — và nó làm ca test §19.2 ở trên **fail**, đồng thời tái tạo lại đúng lỗi "local chạy tốt, production 503 mọi câu hỏi" mà [M11] được viết ra để diệt.

**Sửa (cụ thể).** Viết lại bất biến #3 cho khớp:

> | 3 | Không gian vector của index và của đường query **luôn trùng nhau**: `provider` phải khớp (`store.ts` kiểm tra #5, lỗi `INDEX_PROVIDER_MISMATCH`); `embedding_model` và `dimension` **không được đọc từ env ở đường query** mà lấy từ `index.embedding` (`forQuery`) | Tầng nạp index + factory `forQuery` | Chỉ còn một nguồn sự thật nên không còn gì để lệch. **KHÔNG** so `dimension`/`embedding_model` với env — làm vậy là tái tạo lỗi [M11]. |

Và thêm một câu ở §15.3 ngay trên bảng: bất biến #3 và #13 nói về **cùng một** quy tắc ở hai góc nhìn; nếu thấy chúng khác nhau thì #13 đúng.

---

### R2-M2 — MEDIUM — Không có quy tắc ưu tiên khi nhiều điều kiện `grounding` cùng đúng

**Ở đâu:** §12.2 (bảng 5 trạng thái), §12.3 (lớp 1), §12.4 (code guard CF), §5.2 (sơ đồ luồng). `grounding` là **một** giá trị enum, nhưng các điều kiện không loại trừ nhau.

**Vấn đề.** Ví dụ đủ thực tế: *"lợn con tiêu chảy, tiêm kháng sinh liều bao nhiêu, và ghi nhận ở đâu trong phần mềm?"* → `dosage_intent` bật, `hasApprovedVetBasis() === false`, kho CF rỗng, và nếu truy xuất PIG không có chunk nào qua cổng thì cả `insufficient` cũng đúng. Ba điều kiện cùng thoả: `refused_vet_safety`, `no_cf_docs`, `insufficient`. §12.2 không nói ai thắng; §5.2 chỉ là sơ đồ, không phải thứ tự thực thi; §12.4 là một đoạn code `return` sớm nên hàm ý nó chạy trước, nhưng §12.3 lớp 1 cũng `return` sớm. Hai người implement sẽ cho hai hành vi khác nhau, và một trong hai sẽ trả thông báo "Cloud Farm chưa có tài liệu" cho một câu hỏi xin liều kháng sinh — tức mất đúng phần hướng dẫn liên hệ bác sĩ thú y mà Ch.10 quy tắc 3+4 bắt buộc.

**Sửa (cụ thể).** Viết thành một mục §12.0 "Thứ tự thực thi và ưu tiên trạng thái", đặt **trước** §12.1:

```
Thứ tự thực thi trong pipeline.ts (có comment đánh số 1..7):
1. router miền            → domains, pigScore, cfScore, method
2. retrieve(now, domains) → RetrievalResult + metrics
3. nhận diện ý định rủi ro → risk_flags (dosage_intent, diagnosis_intent)
4. guard thú y lớp 1      → nếu dosage_intent && !hasApprovedVetBasis() ⇒ CHỐT refused_vet_safety
5. guard Cloud Farm       → §12.4 (chỉ khi (4) không chốt)
6. kiểm căn cứ            → nếu mọi miền rỗng ⇒ insufficient
7. còn lại                → ok | partial_no_cf_docs

Ưu tiên khi nhiều điều kiện cùng đúng (chốt một lần, không ghi đè):
refused_vet_safety > no_cf_docs > insufficient > partial_no_cf_docs > ok
```

`risk_flags` và `notices` **vẫn tích luỹ độc lập** với `grounding`: trạng thái `refused_vet_safety` vẫn được phép kèm `Notice` `NO_CF_DOCS` nếu kho CF rỗng và có `cfSignal`, và thông báo từ chối vẫn phải chứa phần liên hệ bác sĩ thú y. Thêm một ca test §19.2 cho đúng câu hỏi ba-điều-kiện ở trên.

---

### R2-M3 — MEDIUM — `dosageIsGrounded(output, approvedBasis)` không định nghĩa `approvedBasis` được tính từ đâu

**Ở đâu:** §12.3 lớp 2 (chữ ký hàm), §15.3 bất biến #5. Chuỗi `approvedBasis` xuất hiện **2 lần trong toàn tài liệu**, cả hai đều trong cùng một đoạn code, không có chỗ nào tính nó.

**Vấn đề.** Kết quả của guard phụ thuộc hoàn toàn vào tập này, và có ít nhất bốn cách hiểu hợp lệ: (a) mọi chunk `approved` trong context; (b) mọi chunk `approved` trong index; (c) các chunk thoả đúng bộ bốn điều kiện của `hasApprovedVetBasis()`; (d) chỉ các chunk `PIG-07`. Chọn (a) hay (b) thì một tài liệu `approved` về **dinh dưỡng** chứa chuỗi `"3 ngày"` sẽ hợp pháp hoá `"tiêm kháng sinh 3 ngày"` — đúng loại lỗ hổng mà H1 vòng 1 chỉ ra, chỉ dịch sang một tầng khác. Chọn (b) còn tệ hơn: nó cho phép truy ngược vào tài liệu **không hề** nằm trong context, tức không nằm trong căn cứ của câu trả lời.

**Sửa (cụ thể).** Khai báo tường minh trong §12.3, dùng **cùng** vị từ với lớp 1 trừ điều kiện "chunk có chứa mẫu liều" (vì phép so chuỗi con đã bao hàm việc đó):

```ts
/** Tập căn cứ cho hậu kiểm = các chunk ĐÃ VÀO CONTEXT và đủ điều kiện làm căn cứ thú y. */
export function approvedVetBasis(context: RankedChunk[]): RankedChunk[] {
  return context.filter(c =>
    c.verification_status === 'approved' &&
    c.exclusion_flags.length === 0 &&
    c.category === 'PIG-07');
}
// gọi: dosageIsGrounded(output, approvedVetBasis(contextChunks))
```

Thêm unit test: `approvedVetBasis` loại chunk `approved` `PIG-05` chứa `"3 ngày"`; và `dosageIsGrounded("tiêm 3 ngày", [chunk PIG-05 approved])` phải `false`.

---

### R2-M4 — MEDIUM — `DOSAGE_PATTERN` được 3 nơi dựa vào nhưng chỉ được mô tả bằng lời, và mô tả hiện tại báo động giả với lượng thức ăn

**Ở đâu:** §12.3 (lớp 1 `DOSAGE_PATTERN.test`, lớp 2 `matchAll`), §19.1 (yêu cầu không báo động giả), §19.2.

**Vấn đề.** Tài liệu đưa ra bốn mảnh regex rời (`\d+\s?(mg|ml|cc|g|IU|UI)\b`, `mg/kg`, `ml/con`, `\d+\s?(ngày|mũi|liều)\b`) kèm điều kiện mơ hồ *"đi cùng từ khoá thuốc/vaccine"* — không nói "đi cùng" là trong cùng câu, cùng cửa sổ bao nhiêu ký tự, hay chỉ cần có mặt trong toàn văn bản. Đây là một **cổng an toàn**, nên mơ hồ ở đây không chấp nhận được. Hai hệ quả đo được:

- **Báo động giả:** `\d+\s?g\b` khớp `"cho ăn 500 g/con"`; `\d+\s?(ngày)\b` khớp `"cai sữa 21 ngày"`, `"28 ngày tuổi"`. Trong một câu trả lời dinh dưỡng mà câu hỏi tình cờ chứa `điều trị`/`vaccine`, lớp 2 sẽ **huỷ toàn bộ** câu trả lời đúng. §19.1 yêu cầu không báo động giả với `"lợn 20 kg"`, `"chuồng 15 m²"` nhưng bỏ sót đúng hai ca sát sườn nhất của miền này.
- **Bỏ sót:** `0,5 ml` (dấu phẩy thập phân) không khớp `\d+\s?ml` nếu không có nhánh thập phân.

**Sửa (cụ thể).** Một module, một hàm, hai tầng mẫu:

```ts
// lib/safety/dosage-pattern.ts
const NUM = String.raw`\d+(?:[.,]\d+)?`;
const STRONG = String.raw`(?:mg\s*\/\s*(?:kg|con)|ml\s*\/\s*(?:kg|con)|cc\s*\/\s*con|(?:IU|UI)\s*\/\s*kg)`;
const WEAK   = String.raw`(?:mg|ml|cc|g|IU|UI|mũi|liều|ngày)`;
const DRUG_CTX = /(thuốc|kháng sinh|vaccine|vắc\s?xin|vacxin|tiêm|chích|phác đồ|điều trị|liều|uống)/i;
const WINDOW = 40;   // ký tự mỗi bên

export const DOSAGE_STRONG = new RegExp(`${NUM}\\s*${STRONG}`, 'gi');
export const DOSAGE_WEAK   = new RegExp(`${NUM}\\s*${WEAK}\\b`, 'gi');

/** Trả về các cụm liều đã chuẩn hoá. STRONG luôn tính; WEAK chỉ tính khi có từ khoá
 *  thuốc/vaccine trong cửa sổ ±40 ký tự quanh vị trí khớp. */
export function findDosages(text: string): string[];
```

`findDosages` là **điểm vào duy nhất** cho cả lớp 1, lớp 2 và bộ lọc trích dẫn ở R2-M9. Bộ ca test bắt buộc (thêm vào §19.1):

| Phải khớp | Phải KHÔNG khớp |
|---|---|
| `15 mg/kg`, `15mg/kg`, `15 mg / kg`, `2 ml/con`, `0,5 ml thuốc`, `tiêm 3 ngày`, `2 mũi vaccine`, `liều 1 g` | `lợn 20 kg`, `chuồng 15 m²`, `cho ăn 500 g/con`, `cai sữa 21 ngày`, `28 ngày tuổi`, `FCR 2,5`, `nhiệt độ 28 độ` |

---

### R2-M5 — MEDIUM — `excluded_expired` không qua cổng liên quan, nên mọi câu trả lời đều kèm cảnh báo "tài liệu hết hiệu lực" và tín hiệu `flag_outdated` của eval mất giá trị

**Ở đâu:** §11.1 điều 3 + đoạn giải thích, §5.4 (`CitationMeta.score` — *"null cho mục trong `excluded_expired`"*), §11.5, §18.2 (`flag_outdated ⇔ excluded_expired_count > 0`), §16.2.

**Vấn đề.** `valid_to` đã qua là **lọc cứng trước khi tính điểm**, nên chunk hết hiệu lực không bao giờ có cosine (đúng như §5.4 ghi `score: null`). Vì vậy `excluded_expired` chứa **tất cả** tài liệu hết hiệu lực của miền đang tìm, bất kể liên quan hay không. Kho demo có đúng một tài liệu như vậy (`PIG-NUT-004`, miền `pig_farming`) ⇒ **mọi** câu hỏi chăn nuôi, kể cả câu về an toàn sinh học, sẽ hiện *"Có 1 tài liệu liên quan nhưng đã hết hiệu lực: PIG-NUT-004"*. Câu đó khẳng định "liên quan" mà không hề đo liên quan.

Hệ quả thứ hai nặng hơn: §18.2 chấm `flag_outdated` bằng `excluded_expired_count > 0`, nên tiêu chí đó **đúng với mọi câu hỏi** — ca test khó `outdated_doc` của Ch.11 sẽ luôn xanh và không chứng minh được gì.

**Sửa (cụ thể).** Tính điểm cho cả chunk hết hiệu lực (chúng bị loại khỏi **context**, không bị loại khỏi việc **tính điểm**):

```
1. Lọc cứng: chỉ còn loại `rejected` và loại sai miền. Chunk hết hiệu lực được GIỮ để tính cosine
   nhưng đánh dấu expired=true và KHÔNG được vào context.
2. excluded_expired = dedupe theo document_id các chunk expired có cosine >= RETRIEVAL_MIN_COSINE,
   sắp theo cosine giảm dần, lấy tối đa 3 tài liệu.
3. CitationMeta.score của mục này = cosine của chunk cao nhất của tài liệu đó (BỎ quy ước score=null;
   sửa cả comment ở §5.4 và ví dụ ở §14.2).
4. metrics.excluded_expired_count = excluded_expired.length  (sau khi đã qua cổng).
5. candidate_count/top_cosine vẫn chỉ tính trên chunk KHÔNG expired, để hai số này không bị tài liệu
   bị loại làm nhiễu.
```

Thêm ca test §19.1: câu hỏi về an toàn sinh học ⇒ `excluded_expired_count === 0` dù kho vẫn có `PIG-NUT-004`; câu hỏi về dinh dưỡng nursery ⇒ `excluded_expired_count === 1`.

---

### R2-M6 — MEDIUM — Bốn thông báo "tất định" là trung tâm của Ch.10 quy tắc 2 nhưng không có nội dung cụ thể ở bất kỳ đâu

**Ở đâu:** §12.2 (ba trạng thái không gọi LLM + `partial_no_cf_docs`), §16.2 (`GroundingNotice` *"nội dung riêng từng trạng thái"*), §16.4.

**Vấn đề.** Thiết kế mô tả chúng bằng chức năng: *"thiếu dữ liệu + **nêu cần bổ sung thông tin gì**"*, *"hướng dẫn liên hệ bác sĩ thú y"*, *"hướng dẫn liên hệ bộ phận phụ trách"*. Riêng *"nêu cần bổ sung thông tin gì"* là điều **không thể** sinh tất định mà không có một danh sách định trước — mà ba trạng thái này theo đúng thiết kế **không gọi LLM**. Đây lại chính là nửa thứ hai của Ch.10 quy tắc 2 (*"nói rõ thiếu dữ liệu **và hỏi thông tin cần thiết**"*) và là thứ mà `ask_for_more_data` trong bộ test Ch.11 chấm. Để ngỏ nghĩa là mỗi người implement tự viết một câu khác nhau, và không có gì để test.

**Sửa (cụ thể).** Một module hằng, tiếng Việt, kèm test đối chiếu từng chuỗi:

```ts
// lib/safety/messages.ts  — văn bản hiển thị, KHÔNG sinh động, có test chốt từng chuỗi
export const MSG_INSUFFICIENT = {
  title: 'Chưa đủ căn cứ để kết luận',
  body: 'Kho kiến thức hiện chưa có tài liệu đủ căn cứ để trả lời câu hỏi này. '
      + 'Hệ thống không suy diễn khi thiếu tài liệu (Ch.10 quy tắc 2).',
  ask: [                            // hỏi thông tin cần thiết — tất định theo miền
    'Giai đoạn/loại lợn: nái hậu bị, nái mang thai, nái nuôi con, lợn con, nursery, grower hay finisher?',
    'Số liệu cụ thể bạn đang có: khối lượng, tuổi, số con, lượng ăn, khoảng thời gian?',
    'Bạn cần gì: giải thích khái niệm, cách tính, hay so sánh với mức mục tiêu?',
  ],
} as const;

export const MSG_REFUSED_VET = {
  title: 'Không thể đưa liều thuốc, phác đồ hay lịch vaccine',
  body: 'Kho kiến thức chưa có quy trình thú y nào được chuyên gia có thẩm quyền duyệt, '
      + 'nên hệ thống không đưa liều thuốc, phác đồ điều trị hoặc lịch vaccine (Ch.10 quy tắc 4).',
  action: 'Vui lòng liên hệ bác sĩ thú y hoặc người có thẩm quyền của trại trước khi dùng thuốc.',
} as const;

export const MSG_NO_CF_DOCS = { /* kho CF chưa có tài liệu + liên hệ key user/bộ phận phụ trách */ } as const;
export const MSG_PARTIAL_NO_CF = { /* phần CF chưa có tài liệu; nội dung dưới đây chỉ thuộc chăn nuôi */ } as const;
```

Quy tắc chọn danh sách `ask`: theo `searched_domains` (miền `cloud_farm` dùng danh sách riêng: phiên bản phần mềm, màn hình đang dùng, thao tác đã thử). Thêm ca test §19.1: mỗi trạng thái trả **đúng** chuỗi trong module này, không có chuỗi nào được ghép động.

---

### R2-M7 — MEDIUM — Ba bước xếp hạng ở §11.2/§11.3 chưa đủ tất định để viết được đúng bộ test mà §19.1 yêu cầu

**Ở đâu:** §11.2 bước 2–4, §11.3 (đoạn chuyển phần dư), §19.1 (ca test *"mỗi miền đúng 1750 token, phần dư chuyển đúng một lần"*).

**Vấn đề.** Ba chỗ còn nhiều hơn một cách hiểu:

1. **Bước 2 — "tối đa 2 chunk mỗi `document_id`"**: không nói giữ 2 chunk nào. Theo cosine? theo `final_score`? theo thứ tự xuất hiện trong index?
2. **Thứ tự bước 2 và bước 3**: cắt theo tài liệu trước rồi mới lấy top-K, hay ngược lại? Hai thứ tự cho hai tập kết quả khác nhau khi một tài liệu chiếm 4 trong 6 chỗ đầu.
3. **Chuyển phần dư (§11.3)**: *"phần dư của miền không dùng hết được chuyển cho miền còn lại đúng một lần"* — nếu **cả hai** miền đều còn dư thì ai nhận của ai? Và nếu hai miền chuyển cho nhau thì "đúng một lần" tính thế nào? Không có thứ tự cố định thì ca test ở §19.1 không tất định, và `npm run eval` không tái lập được giữa hai lần chạy trên hai máy.

**Sửa (cụ thể).** Viết thành thuật toán có số bước, trong §11.2:

```
Trong TỪNG miền, theo đúng thứ tự:
1. cosine cho mọi chunk còn lại sau lọc cứng (gồm cả expired, xem R2-M5)
2. cổng liên quan: cosine >= RETRIEVAL_MIN_COSINE
3. sắp giảm dần theo final_score; đồng điểm thì theo cosine giảm dần; vẫn đồng thì theo chunk_id tăng dần
4. trần theo tài liệu: quét danh sách đã sắp từ đầu, giữ tối đa RETRIEVAL_MAX_PER_DOC = 2 chunk ĐẦU TIÊN
   của mỗi document_id (tức 2 chunk điểm cao nhất của tài liệu đó), bỏ phần còn lại
5. lấy RETRIEVAL_TOP_K = 6 chunk đầu
6. cắt theo ngân sách của miền (§11.3): bỏ từ CUỐI danh sách lên cho tới khi vừa ngân sách

Phần dư (chỉ khi searched_domains có 2 miền), tất định:
7a. cả hai miền cắt xong với 50% ngân sách
7b. leftover_pig = budget_pig - used_pig ; leftover_cf = budget_cf - used_cf
7c. phân phối theo thứ tự cố định: pig_farming nhận leftover_cf trước, rồi cloud_farm nhận leftover_pig
    (tính trên giá trị ở 7b, KHÔNG tính lại) — mỗi miền được cắt lại nhiều nhất MỘT lần, và chỉ khi
    miền đó còn chunk bị bỏ ở bước 6
```

Bước 7c vẫn không so điểm giữa hai miền (bất biến #7 giữ nguyên) — nó chỉ phân phối số token.

---

### R2-M8 — MEDIUM — Nhánh `cfScore >= pigScore` với cả hai điểm bằng 0 làm một câu hỏi chăn nuôi hợp lệ bị từ chối bằng thông báo Cloud Farm

**Ở đâu:** §12.4 (đoạn code `const cfIsDominantIntent = router.cfScore >= router.pigScore;`), §10 (nhánh `fallback`).

**Vấn đề.** Khi cả hai điểm = 0, §10 cho `both` với `method='fallback'`; §12.4 tính `cfIsDominantIntent = (0 >= 0) = true` ⇒ `return deterministic('no_cf_docs')` — **từ chối toàn bộ** và hiển thị *"kho Cloud Farm chưa có tài liệu nào được nạp…"* ngay cả khi miền chăn nuôi có đầy đủ căn cứ. Câu hỏi chăn nuôi dùng từ ngữ không nằm trong bảng từ khoá (bảng này chỉ sinh từ tên nhóm + glossary) sẽ nhận một thông báo nói về phần mềm. Đây vừa là hành vi sai vừa là một đường làm `partial_no_cf_docs` gần như không đạt được (xem thêm R2-H2).

**Sửa (cụ thể).** Phân biệt "đã tìm miền CF" với "người dùng thật sự hỏi về CF":

```ts
const cfWasSearched = retrieval.searched_domains.includes('cloud_farm');
const cfEmpty = retrieval.cloud_farm.length === 0;

if (cfWasSearched && cfEmpty) {
  const pigEmpty  = retrieval.pig_farming.length === 0;
  // có tín hiệu CF thật: từ vựng CF (R2-H2) hoặc LLM tầng 2 kết luận có CF
  const cfSignal  = router.cfScore > 0 || router.method === 'llm';

  if (cfSignal && (pigEmpty || router.cfScore >= router.pigScore)) {
    return deterministic('no_cf_docs');            // KHÔNG gọi LLM
  }
  if (cfSignal) {
    grounding = 'partial_no_cf_docs';
    notices.push(NO_CF_DOCS_NOTICE); riskFlags.push('cf_no_docs'); hardRules.push(CF_SCOPE_LOCK);
  }
  // không có tín hiệu CF nào ⇒ KHÔNG gắn cảnh báo CF vào một câu hỏi chăn nuôi thuần.
  // Nếu miền PIG cũng rỗng thì đi tiếp theo nhánh insufficient của §12.2 (xem R2-M2).
}
```

Thêm ca test §19.2: câu hỏi chăn nuôi **không** chứa từ khoá nào của cả hai bảng (ép `fallback`, `0/0`) nhưng truy xuất PIG **có** chunk ⇒ `grounding === 'ok'`, **không** có `Notice` `NO_CF_DOCS`.

---

### R2-M9 — MEDIUM — Trích dẫn kèm theo trạng thái `refused_vet_safety` dựa vào một điều kiện không có cách kiểm

**Ở đâu:** §12.3 lớp 1 (câu *"vẫn đưa các chunk tìm được dưới dạng 'thông tin tham khảo chung, không phải chỉ định điều trị' **nếu bản thân chúng không mang tính kê liều**"*).

**Vấn đề.** "Mang tính kê liều" không được định nghĩa và không có hàm nào kiểm. Đây là nhánh **từ chối vì an toàn thú y**, nên nếu hiểu lỏng thì hệ thống vừa từ chối đưa liều vừa đính kèm một đoạn tài liệu `in_review` có chứa liều — tức phát đúng cái vừa từ chối, chỉ đổi nhãn.

**Sửa (cụ thể).** Dùng lại `findDosages()` của R2-M4 làm phép kiểm duy nhất:

```ts
// khi grounding === 'refused_vet_safety'
const refCitations = contextChunks
  .filter(c => findDosages(c.text).length === 0)      // chunk có mẫu liều ⇒ KHÔNG đính kèm
  .map(toCitationMeta);
```

UI (§16.2) hiển thị khối này dưới tiêu đề *"Thông tin tham khảo chung — không phải chỉ định điều trị"*, và khi `refCitations` rỗng thì **không** hiện khối trích dẫn. Thêm ca test §19.2: fixture `in_review` `PIG-07` có mẫu liều ⇒ không xuất hiện trong `citations` của câu trả lời `refused_vet_safety`.

---

### R2-M10 — MEDIUM — `/api/health` đọc index nhưng không được khai trong `outputFileTracingIncludes`, nên đúng công cụ kiểm tra sau deploy lại báo sai

**Ở đâu:** §9.4 (`next.config.ts`, chỉ khai `'/api/chat'`), §14.3 (health trả `index.chunks`, `ingested_at`, `by_domain`, `by_verification_status`), §17.1 bước 4.

**Vấn đề.** `/api/health` phải gọi `getIndex()` để trả được các số đó. Trên Vercel, file không được khai trong `outputFileTracingIncludes` sẽ **không** nằm trong bundle của function đó, nên health sẽ báo `index.present: false` (hoặc `INDEX_MISSING`) trên một bản deploy mà `/api/chat` chạy hoàn toàn bình thường. §17.1 lại dựng health thành bước kiểm tra sau deploy — người deploy sẽ kết luận sai là index chưa lên, rồi đi ingest lại một cách vô ích.

**Sửa (cụ thể).**

```ts
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/chat':   ['./data/kb-index.json', './data/kb-vectors.bin', './data/glossary.json'],
    '/api/health': ['./data/kb-index.json', './data/kb-vectors.bin'],
  },
};
```

(`glossary.json` không cần cho health.) Thêm vào §17.1 một bước nghiệm thu: sau deploy, `GET /api/health` phải trả `index.present === true`, `embedding.provider === "gemini"`, `embedding.source === "index-metadata"`.

---

### R2-M11 — MEDIUM — Đường đi tới bản deploy chạy được còn thiếu một bước, và bước đó không bước workflow nào làm được

**Ở đâu:** §17.1 (5 bước deploy + vòng cập nhật kiến thức), §9.1 (ingest cần API key), §21.2 (key **không** được cấp vào môi trường của bất kỳ bước workflow nào).

**Vấn đề.** Yêu cầu của chủ sở hữu là *"cho tôi phát hành nó qua internet"*, tức tiêu chí hoàn thành là một URL trả lời được câu hỏi. Nhưng:

- `data/kb-index.json` + `data/kb-vectors.bin` phải **được commit** (§9.3) vì Vercel build không có key embedding;
- sinh hai file đó cần `npm run ingest` với key thật, mà key không được cấp cho bước workflow nào;
- §17.1 bước 1 bắt đầu bằng *"push code"* và không có bước nào nói "chạy ingest trước khi push lần đầu".

Kết cục theo đúng chữ của tài liệu: bản deploy đầu tiên trả `503 INDEX_MISSING` cho **mọi** câu hỏi. Tệ hơn: nếu bước implement commit một index sinh bằng `EMBEDDING_PROVIDER=mock` (việc rất dễ xảy ra vì mock là đường duy nhất nó chạy được), production với `EMBEDDING_PROVIDER=gemini` sẽ trả `503 INDEX_PROVIDER_MISMATCH` cho mọi câu hỏi — thất bại im lặng hơn, vì repo *trông như* đã có index.

**Sửa (cụ thể).** Ba câu phải có trong thiết kế:

1. **§17.1 thêm bước 0 (chủ sở hữu làm ở máy local, trước khi push lần đầu):**
   ```
   npm.cmd install
   # tạo .env.local, đặt GEMINI_API_KEY=<key thật>   (.env.local đã nằm trong .gitignore)
   npm.cmd run ingest
   # commit: knowledge/**, data/kb-index.json, data/kb-vectors.bin, data/glossary.json
   ```
2. **Quy tắc cho bước implement:** **không** được commit index sinh bằng `mock` vào `data/`. Index mock chỉ tồn tại dưới `tests/fixtures/` (đã có `npm run fixtures`). Nếu chưa có key, `data/` để **trống** và README nói rõ bước 0 là điều kiện để deploy trả lời được.
3. **§15.1 / §16.4:** thông báo `503 INDEX_MISSING` phải nêu đúng việc cần làm cho người **deploy** (chạy ingest ở local rồi commit `data/`), không chỉ *"Chạy `npm run ingest`"* — vì người đọc nó có thể đang ở trên Vercel, nơi không chạy được lệnh đó.

---

### R2-N1 — NIT — Cờ `--reuse-vectors` được nhắc ở §17.3 nhưng không tồn tại trong đặc tả ingest

§9.1 bước 9 mô tả việc tái dùng vector là **không điều kiện**, và danh sách cờ ở §9.5 chỉ có `--strict`, `--dry-run`, `--fail-on-pii`, `--allow-pii --reason`. §17.3 lại viết *"bật `--reuse-vectors` mặc định"*. **Sửa:** xoá cụm đó ở §17.3 (vì tái dùng đã là mặc định), hoặc thêm cờ nghịch `--no-reuse-vectors` vào §9.5 cho trường hợp muốn build lại toàn bộ. Chọn một.

---

### R2-N2 — NIT — `animal_stage` không có tập giá trị, và hai mục mô tả nó khác nhau

§5.4 khai `animal_stage: string[] | null` (chuỗi tự do) còn §8.1 ghi *"mảng enum giai đoạn"* — không chỗ nào liệt kê enum. **Sửa:** khai enum ngay trong `lib/kb/types.ts`, lấy từ Ch.2.1/Ch.5: `'nai_hau_bi' | 'nai_mang_thai' | 'nai_nuoi_con' | 'lon_con' | 'nursery' | 'grower' | 'finisher' | 'duc_giong'`, và sửa §5.4 thành `AnimalStage[] | null`. Giá trị lạ ⇒ cảnh báo (giữ như §8.1), không phải lỗi cứng.

---

### R2-N3 — NIT — Thư mục `05_Expert_Reviewed_QA/` sẽ làm ingest lỗi cứng ngay khi có file Q&A đầu tiên

`05_Expert_Reviewed_QA/` không có trong `PATH_TAXONOMY` (23 khoá) và cũng không nằm trong danh sách loại trừ của §9.1 bước 1 (`_sources/**`, `README.md`, `*.template.md`). Theo quy tắc *"file `.md` ở thư mục không có trong bảng ⇒ lỗi cứng"*, cặp Q&A đầu tiên do chuyên gia duyệt (Ch.4.3) sẽ làm `npm run ingest` dừng. **Sửa:** thêm `05_Expert_Reviewed_QA/**` vào danh sách loại trừ ở §9.1 bước 1, kèm một câu lý do: Q&A chuyên gia là dữ liệu cho fine-tuning (Ch.4.3) và cho bộ test (Ch.11), **không** phải tài liệu RAG.

---

### R2-N4 — NIT — `CitationMeta.score` không nói là cosine thuần hay `final_score`

§5.4 chỉ ghi `score: number | null`. Ví dụ ở §14.2 có `"score":0.62` trùng với `metrics.top_cosine: 0.62`, gợi ý cosine thuần, nhưng không ở đâu nói ra. **Sửa:** đổi comment thành `score: number | null; // cosine THUẦN của chunk được dẫn (không nhân hệ số) — khớp đơn vị với metrics.top_cosine`, và nếu muốn hiện cả điểm xếp hạng thì thêm field riêng `rank_score`.

---

### R2-N5 — NIT — "Khoảng hợp lệ" của các biến số không được liệt kê, và `SESSION_SECRET` quá ngắn bị gán mã lỗi nói sai bản chất

§15.2 ghi *"Số: `coerce.number()` + khoảng hợp lệ, sai thì dùng mặc định và log `warn`"* nhưng không có khoảng nào cho `SESSION_TTL_HOURS`, `RETRIEVAL_TOP_K`, `RETRIEVAL_MAX_PER_DOC`, `RETRIEVAL_MIN_COSINE`, `CHUNK_*`, `LLM_ATTEMPT_TIMEOUT_MS`. Ngoài ra `SESSION_SECRET` dài < 32 ký tự là **có mặt nhưng không hợp lệ**, trong khi mã lỗi duy nhất được định nghĩa là `CONFIG_MISSING`. **Sửa:** thêm một bảng nhỏ vào §6.1 (`SESSION_TTL_HOURS` 1–168; `RETRIEVAL_TOP_K` 1–20; `RETRIEVAL_MAX_PER_DOC` 1–5; `RETRIEVAL_MIN_COSINE` 0–1; `CHUNK_MAX_TOKENS` 128–2048; `CHUNK_MIN_TOKENS` 0–`CHUNK_MAX_TOKENS`; `LLM_ATTEMPT_TIMEOUT_MS` 5.000–45.000), và dùng chung mã `CONFIG_MISSING` nhưng `message` nêu rõ *"`SESSION_SECRET` phải dài ít nhất 32 ký tự"* để người quản trị không đi tìm một biến đã có.

---

### R2-N6 — NIT — Hai lệch có chủ ý được biện minh bằng một "brief" không có trong repo

§6.1 (*"Brief của orchestrator ghi mặc định `openai-compatible`"*) và §21.1 giả định 3 (*"Số câu test Ch.11 trong repo là rút gọn… theo yêu cầu brief"*) dẫn một tài liệu mà người implement và người duyệt sau này không đọc được — riêng điểm thứ hai còn lệch với con số Ch.11 ghi rõ (30/40/30/20/30/50). **Sửa:** bỏ việc dẫn "brief" và viết lý do tự đứng được: với Ch.11, ghi một dòng trong `docs/MAPPING.md` dạng *"`qa-seed.jsonl` = 4–6 câu/nhóm, là **khung** chờ chuyên gia mở rộng lên 30–50 câu/nhóm theo Ch.11; `expected_answer` để trống theo yêu cầu Ch.11"*. Câu hỏi (không cần đáp án) là thứ rẻ, nên cũng có thể chọn soạn đủ số lượng Ch.11 ngay — nếu không chọn, lý do phải nằm trong tài liệu, không nằm trong một brief.

---

### R2-N7 — NIT — Không có trần kích thước body trước khi `req.json()`

§14.1/§14.2/§15.2 chỉ validate **sau** khi đã parse JSON. Hai route nằm sau đăng nhập và sau rate limit nên rủi ro nhỏ, nhưng một body rất lớn vẫn bị parse vào bộ nhớ trước khi `message` ≤ 2000 ký tự được kiểm. **Sửa:** ở đầu cả hai handler, nếu `Number(req.headers.get('content-length')) > 64_000` ⇒ `400 INVALID_BODY` ngay, và bọc `await req.json()` trong `try/catch` ⇒ `400 INVALID_BODY` (hiện §14.2 chưa nói body không parse được thì trả gì, §14.1 thì có).

---

### R2-N8 — NIT — Nhánh tự host (Docker + chế độ `TRUSTED_PROXY=false`) mở rộng phạm vi so với yêu cầu "phát hành qua internet"

Yêu cầu gốc là phát hành công khai; §17.1 (GitHub → Vercel) đã đủ. §17.2 thêm `Dockerfile`, `.dockerignore`, hướng dẫn Render/Fly/VPS, và chế độ rate limit thứ hai (`untrusted-shared`) chỉ tồn tại để phục vụ nhánh này — tức thêm một đường mã có nhánh an toàn riêng phải test ([M13] ở §19.1). **Sửa:** giữ `output: 'standalone'` (vô hại) nhưng chuyển Dockerfile + hướng dẫn tự host sang một mục "tuỳ chọn, chưa nghiệm thu" trong README, và ghi `docs/MAPPING.md` là *"chưa kiểm thử"*; hoặc giữ nguyên phạm vi nhưng nói rõ bước implement **phải** test cả hai giá trị `TRUSTED_PROXY`. Chọn một, đừng để nửa vời.

---

## Tổng hợp

| Mức | Số lượng | ID |
|---|---|---|
| HIGH | 2 | R2-H1, R2-H2 |
| MEDIUM | 11 | R2-M1, R2-M2, R2-M3, R2-M4, R2-M5, R2-M6, R2-M7, R2-M8, R2-M9, R2-M10, R2-M11 |
| NIT | 8 | R2-N1 … R2-N8 |

**Verdict: `CHANGES_REQUESTED`** (2 HIGH + 11 MEDIUM > 0).

Hai HIGH đều cùng một dạng: bản sửa vòng 1 đặt chốt chặn **ở đúng chỗ**, nhưng **điều kiện kích hoạt** chốt chặn đó lại dựa vào một bộ nhận diện từ khoá bỏ sót (danh sách ý định liều thuốc ở R2-H1, bảng từ khoá miền ở R2-H2). Khi sửa, nguyên tắc nên dùng là: cho chốt chặn chạy **mặc định** và để bộ nhận diện chỉ quyết định *cách* xử lý (hoãn stream hay không, có cảnh báo hay không), chứ không quyết định *có kiểm hay không*.


