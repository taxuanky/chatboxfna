# Review thiết kế — vòng 3

> Đối tượng: `d:/FARM/.agents/tasks/design.md` (2.746 dòng, 22 mục, bản "vòng 3 — đã xử lý review vòng 2").
> Nguồn chân lý nghiệp vụ: `d:/FARM/docs/de-an-chatbot-cloud-farm.txt` (Đề án v1.0, 11/2026).
> Người review đọc thiết kế **không mang ngữ cảnh của bước đã viết nó**. Không chạy build/test (chưa có code).
> Mọi dữ kiện ở mục "Giả định đã kiểm chứng" đều **chạy thật** trong vòng review này.

**Verdict: `CHANGES_REQUESTED`** — 2 HIGH, 13 MEDIUM, 6 NIT. HIGH/MEDIUM đều chặn.

Nhận định chung: thiết kế đã ở mức triển khai được, và 21 finding vòng 2 đều có dấu vết sửa thật
trong văn bản (xem "Kiểm tra hồi quy"). Hai HIGH của vòng 3 **không** lặp lại vòng trước: chúng là
lỗ hổng *bên trong* chính hai bản sửa R2-H2 và R2-M4 — một cơ chế an toàn được đặc tả bằng lời
nhưng **không có chỗ nào trong hợp đồng kiểu dữ liệu để chở nó**, và một bộ nhận diện an toàn
chỉ bắt được dạng biểu đạt hẹp hơn chính quy tắc nó bảo vệ. Phần MEDIUM chủ yếu là chi tiết mà
người implement buộc phải tự đoán, cộng ba chỗ hai mục trong tài liệu nói khác nhau.

---

## Giả định đã kiểm chứng (chạy thật trong vòng review này)

| # | Điều thiết kế khẳng định | Cách kiểm | Kết quả |
|---|---|---|---|
| 1 | Đề án **có** BOM `EF BB BF`, nên bước `replace(/^\uFEFF/,'')` của §12.1 là cần thật | đọc 3 byte đầu | ✅ `EF BB BF` |
| 2 | Đề án hiện chỉ có LF (§12.1) | kiểm chuỗi `\r\n` | ✅ 0 CRLF; `split(/\r?\n/)` đúng và vẫn chịu được CRLF |
| 3 | Hai marker `10. Quy tắc trả lời an toàn cho chatbot` / `11. Bộ kiểm thử chất lượng chatbot` tồn tại và **duy nhất** | `IndexOf` + đếm số lần xuất hiện | ✅ mỗi marker xuất hiện **đúng 1 lần** (offset 11297 và 12083) — `slice` không thể lấy nhầm mục lục |
| 4 | Trích xuất giữa hai marker cho **đúng 7 dòng** không rỗng (§12.1, [M15]) | chạy đúng quy trình §12.1 trên file thật | ✅ 7 dòng |
| 5 | `CH10_SAFETY_RULES` khớp **từng ký tự và đúng thứ tự** với đề án | so `-ceq` từng phần tử; cả hai chuỗi **lấy ra từ file**, không gõ tay | ✅ 7/7 khớp tuyệt đối. Cả hai file đều ở dạng NFC nên `indexOf`/`toEqual` không bị bẫy chuẩn hoá Unicode |
| 6 | `.gitignore` đang ignore `data/kb-index.json` kèm ghi chú "decision pending" và **phải bỏ dòng đó** (§2, §9.3) | đọc `.gitignore` | ✅ đúng như mô tả. Thêm một dữ kiện có lợi: `.gitignore` **không** có dòng nào bắt `*.bin` hay `data/`, nên bỏ đúng một dòng là đủ, và `.env*.local` vẫn được ignore |
| 7 | Node v24.19.0, npm 11.17.0, Git tại `$env:LOCALAPPDATA\Programs\Git\cmd\git.exe` không nằm trong PATH (§2) | `node -v`, `cmd /c npm -v`, `Test-Path` | ✅ đúng cả ba |
| 8 | Workspace là greenfield (§2) | kiểm `node_modules`, `package.json` | ✅ chưa có cả hai — mọi khẳng định về thư viện vẫn là **chưa kiểm**, xem bảng dưới |
| 9 | Mọi số đo Gemini ở §6.2/§6.3/§21.2 đến từ `verify-gemini.md` | đối chiếu từng dòng | ✅ khớp: `?key=` 200 / Bearer 401; `gemini-3.5-flash` OK×2; `gemini-3.8-flash` và `gemini-flash-latest` 503×2; `gemini-2.5-flash` 404; chuẩn L2 **0,592158 / 0,699158 / 1,000000**; SSE 503 còn treo |
| 10 | Phụ lục B có 12 nguồn và §7.2 liệt kê đủ 12, **chỉ danh mục, không nội dung** | đối chiếu từng URL trong đề án | ✅ 12/12 (Merck ×3, PIC ×2, KSU, WOAH ×2, FAO, chinhphu, vbpl, FAOLEX); `license_status: needs_review` cho cả 12 — đúng cảnh báo Phụ lục B |
| 11 | Ch.9 được encode đúng: trọng số và ngưỡng | đối chiếu đề án | ✅ 20/25/15/15/15/10 = 100; 85–100 / 70–84 / <70; 5 điều kiện loại trừ ↔ 5 giá trị `exclusion_flags` |
| 12 | Ch.11 có 6 nhóm với 30/40/30/20/30/50 câu và 7 tiêu chí chấm tay | đối chiếu đề án | ✅ đúng; §18.1 nói thẳng là rút gọn còn 4–6 câu/nhóm và ghi lý do, `expected_answer` luôn `null` |
| 13 | `PATH_TAXONOMY` phủ 23 thư mục có thể chứa `.md` | đếm khoá trong bảng §7.0 và đối chiếu Phụ lục A | ✅ 12 PIG + 7 CF + 3 Legal + 1 Glossary = 23; cây con Phụ lục A được giữ 100%, chỉ đổi tên gốc |
| 14 | Hai miền không trộn **ở mức kiểu dữ liệu** (§5.3) | đọc `RetrievalResult` | ✅ hai field riêng; không có mảng phẳng nào trong hợp đồng — **trừ** `excluded_expired`, xem R3-M8 |
| 15 | Không bịa bất cứ thứ gì về Cloud Farm | quét toàn tài liệu tìm tên menu/nút/trường/phân hệ | ✅ không có. `CF_OPERATION_LEXICON` (§10) chỉ gồm danh từ chung về việc *dùng một phần mềm*, đúng như nó tự tuyên bố |
| 16 | Không hard-code key; chỉ `.env.example` placeholder; validate key chỉ `min(1)` | đọc §6.1, §15.2, §17.1 | ✅ đúng, và không có regex `AIza` nào trong tài liệu |
| 17 | Đồng hồ máy đích | `Get-Date` | ✅ **2026-11-06** (vòng 2 đo 2026-11-05). Tài liệu mẫu `2026-11-01` vẫn ở quá khứ ⇒ quy tắc "không ở tương lai" của §8.1 vẫn pass. Đồng hồ nhảy ngày **không** làm vỡ gì vì §8.1 nhận `now` qua tham số |

---

## Giả định CHƯA kiểm chứng (và một chỗ tài liệu tự nhận sai)

Không mục nào dưới đây **sai theo bằng chứng hiện có**; chúng chưa có bằng chứng. Thiết kế đã
liệt kê phần lớn ở §21.2 — đó là điểm mạnh, giữ nguyên. Bảng này bổ sung những chỗ §21.2 **chưa** nói.

| # | Khẳng định | Trạng thái | Vì sao quan trọng |
|---|---|---|---|
| 1 | `maxDuration = 60` là trần Vercel Hobby | **Chưa kiểm** — §21.2 mục 8 đã ghi, có chỉ dẫn sửa đúng một hằng | `DEADLINE_MS = 50_000` và assertion `DEADLINE_MS + 5s <= maxDuration*1000` đều dựa vào nó |
| 2 | `react-markdown@9` không render raw HTML khi thiếu `rehype-raw`; `outputFileTracingIncludes` ở top-level Next 15; `NextRequest.ip` đã bỏ ở Next 15 | **Chưa kiểm** — §21.2 mục 10 đã ghi | Ba biên: XSS, đưa index vào bundle, cách lấy IP cho rate limit |
| 3 | Heuristic `ceil(chars/3.5)` ước lượng **cao hơn** thực tế cho tiếng Việt | **Chưa đo** — §21.2 mục 9 đã ghi | Nếu nó ước lượng **thấp hơn**, prompt vượt trần im lặng. Liên quan trực tiếp R3-M6 |
| 4 | Hành vi batch `gemini-embedding-2`, số MTEB 67.99/68.17 | **Chưa đo**, đã dán nhãn `[N3]` và đã chặn bằng assertion `vectors.length === texts.length` | Kết luận thiết kế không phụ thuộc hai khẳng định này — xử lý đúng |
| 5 | **"Vercel Hobby chỉ cấp runtime 20.x/22.x, ghim 24 sẽ làm build fail"** (§4) | **Chưa kiểm, và KHÔNG có trong §21.2** | Hệ quả nhẹ (`engines.node >= 20.9.0` là khoảng rộng, không khoá gì), nhưng đây là một khẳng định về nền tảng bên ngoài đứng ngoài bảng xác minh — thêm vào §21.2 để giữ đúng chuẩn mà chính tài liệu đặt ra |
| 6 | Hình dạng mảnh SSE của Gemini | **Còn treo** (503 lúc đo) — §21.2 mục 4 | Đã có đường hạ cấp `:generateContent`, nên không chặn thiết kế |

Một chỗ thiết kế **tự nhận là sai và đã sửa**, kiểm lại thấy đúng: câu "không cần key embedding
trên Vercel" của vòng 1 (§17.1 bước 3) — câu hỏi người dùng vẫn phải nhúng lúc runtime, nên
fallback `EMBEDDING_API_KEY ?? GEMINI_API_KEY` là **bắt buộc hiện thực**. Bước implement đừng đọc
tài liệu cũ rồi bỏ fallback đó.

---

## Findings

### R3-H1 — HIGH — `cfSignal` có thể bằng `true` trong khi miền CF **không** được tìm, nên guard Cloud Farm chết; và không có field nào chở được quy tắc "vẫn tìm CF"

**Ở đâu:** §10 (cây quyết định tầng 1, dòng *"VẪN thêm `'cloud_farm'` vào `searched_domains`"*) · §10 `RouterResult` · §12.0 bước 2 (`retrieve(now, domains)`) · §5.3 `RetrievalResult.searched_domains` · §12.4 (điều kiện `cfWasSearched`).

**Vấn đề:** §12.4 mở guard bằng `retrieval.searched_domains.includes('cloud_farm')`, và §12.4 nói rõ
lý do chọn `searched_domains` thay vì `router.domains`: *"nó là sự thật về việc đã tìm ở đâu"*.
Nhưng `searched_domains` là field của `RetrievalResult`, do `retrieve()` trả về, và §12.0 gọi
`retrieve(now, domains)` với `domains` **lấy từ `RouterResult`**. `RouterResult` chỉ có
`domains | method | confidence | pigScore | cfScore | cfSignal` — **không có chỗ nào để nói "chỉ
lấy chunk của pig, nhưng hãy ghi nhận là đã tìm CF"**. Nên quy tắc then chốt của [R2-H2] không có
đường hiện thực đúng, và cách đọc theo đúng chữ (`domains = ['pig_farming']` vì nhánh ghi *"chỉ
miền thắng"*) cho `searched_domains = ['pig_farming']` ⇒ guard §12.4 **không chạy**.

Hai đường nữa dẫn tới cùng hậu quả, lần này không phải lỗi diễn đạt mà là lỗ thật:

1. **`method='user'`.** §10: người dùng chọn miền ở UI thì *"dùng luôn"*. Người dùng để bộ chọn ở
   "Chăn nuôi lợn" (giá trị dính từ câu trước) rồi hỏi *"làm sao sửa số liệu cám đã nhập sai trong
   phần mềm?"* ⇒ `domains = ['pig_farming']`, nhưng `cfScore > 0` (khớp `CF_OPERATION_LEXICON`) nên
   `cfSignal = true`. CF không được tìm ⇒ `cfWasSearched = false` ⇒ guard không chạy ⇒ vài chunk PIG
   qua cổng liên quan ⇒ `grounding: 'ok'` ⇒ **LLM được gọi để trả lời câu hỏi phần mềm, không có
   `CF_SCOPE_LOCK`**, lớp bảo vệ duy nhất còn lại là một câu dặn trong prompt.
2. **`method='llm'`.** Tầng 2 chỉ chạy khi `min = 0 && max = 1`, tức có thể `cfScore = 1`,
   `pigScore = 0`. LLM trả `pig_farming` ⇒ `domains = ['pig_farming']` trong khi `cfSignal = true`.
   Cùng kết cục.

Đây đúng là rủi ro Ch.14 (*"Cloud Farm thiếu manual → chatbot bịa chức năng"*) và Ch.10 quy tắc 5,
quay lại qua ba cửa mà [R2-H2] không bịt. §1 tuyên bố an toàn được cưỡng chế bằng code chứ không
bằng prompt, nên ba đường này là vi phạm chính tuyên bố đó.

**Sửa (chốt một bất biến, rồi cho kiểu dữ liệu chở nó):**

1. Ghi thành bất biến mới trong §15.3: **`cfSignal === true` ⇒ `'cloud_farm' ∈ searched_domains`**,
   không ngoại lệ, không phụ thuộc `method`. Thêm: **khi `index.stats.by_domain.cloud_farm === 0`
   thì `'cloud_farm'` LUÔN có trong `searched_domains`** — truy xuất trên kho rỗng tốn 0 ms, nên
   không có lý do hiệu năng nào để bỏ, và nhờ vậy §12.4 luôn được đánh giá.
2. Cho `retrieve()` tự tính field đó thay vì nhận gián tiếp, và đổi chữ ký cho tường minh:
   ```ts
   // lib/kb/retrieve.ts
   export async function retrieve(args: {
     now: Date;
     queryVec: Float32Array;
     index: LoadedIndex;
     router: RouterResult;          // thay vì chỉ `domains`
   }): Promise<RetrievalResult>;

   // bên trong:
   const cfEmptyStore = index.stats.by_domain.cloud_farm === 0;
   const searched: Domain[] = [...new Set<Domain>([
     ...args.router.domains,
     ...(args.router.cfSignal || cfEmptyStore ? ['cloud_farm' as Domain] : []),
   ])];
   // chỉ chấm điểm thật cho miền có chunk; miền rỗng vẫn được ghi vào searched_domains
   ```
3. Bỏ dòng *"VẪN thêm `'cloud_farm'` vào `searched_domains`"* khỏi cây quyết định §10 — router
   **không** sở hữu `searched_domains`. Cây §10 chỉ còn kết luận `domains` + `cfSignal`.
4. Xác nhận lại ngân sách: với `searched_domains` 2 miền, §11.3 chia 50/50 rồi 6c trả phần dư, nên
   miền PIG vẫn nhận tới 3500 token khi CF rỗng. Không cần nhánh đặc biệt, nhưng §11.3 phải nói rõ
   là **`searched_domains`** (không phải "miền có kết quả") là đầu vào của phép chia.
5. Thêm 2 ca test tích hợp §19.2: (a) `domain: 'pig_farming'` do người dùng chọn + câu hỏi chứa
   `"trong phần mềm"` ⇒ `grounding ∈ {no_cf_docs, partial_no_cf_docs}`, **không** được `'ok'`;
   (b) tầng 2 trả `pig_farming` khi `cfScore = 1` ⇒ `searched_domains` vẫn chứa `'cloud_farm'`.

---

### R3-H2 — HIGH — Hậu kiểm quy tắc 4 chỉ bắt liều dạng **số + đơn vị**; phác đồ và lịch vaccine diễn đạt bằng tuần/lần/chữ đi thẳng tới người dùng

**Ở đâu:** §12.3a (`NUM`, `STRONG`, `WEAK`) · §12.3 lớp 2 (`dosageIsGrounded`) · §19.1 (bộ ca test `dosage-pattern.ts`) · §20 dòng Ch.10 q.4 (ghi trạng thái *"Đã làm"*).

**Vấn đề:** Ch.10 quy tắc 4 cấm ba thứ: *"liều thuốc, **phác đồ điều trị** hoặc **lịch vaccine**"*.
`findDosages()` là điểm vào duy nhất và nó chỉ khớp `NUM = \d+(?:[.,]\d+)?` + đơn vị trong
`{mg, ml, cc, g, IU, UI, mũi, liều, ngày}`. Ba dạng biểu đạt rất thường gặp **không khớp gì cả**:

| Đầu ra LLM (hợp lý cho câu hỏi thật ở trại) | `findDosages()` | Vì sao lọt |
|---|---|---|
| *"tiêm vaccine lúc 3 tuần tuổi, nhắc lại sau 4 tuần"* | rỗng | `tuần` không có trong `WEAK` — **đúng là một lịch vaccine** |
| *"cho uống 2 lần/ngày trong một tuần"* | rỗng | `lần` không có trong `WEAK`; `ngày` đứng sau `/` chứ không sau số |
| *"dùng kháng sinh nhóm aminoglycoside trong vài ngày rồi nhắc lại"* | rỗng | không có chữ số nào — **đúng là một phác đồ** |

Và lớp 1 **không** bắt được các câu hỏi dẫn tới những đầu ra đó: câu *"lợn con tiêu chảy thì xử lý
thế nào?"* (chính ca mà [R2-H1] lấy làm ví dụ) không khớp danh sách ý định liều, nên `dosage_intent
= false`; `mustBuffer` vẫn bật nhờ điều kiện `category PIG-07/PIG-08`, nhưng phép kiểm chạy sau đó
là `dosageIsGrounded()` — và nó không thấy gì để kiểm. Kho demo không có tài liệu `approved` nào,
nên **mọi** phác đồ/lịch vaccine trong đầu ra đều là nội dung chưa được chuyên gia duyệt. §20 ghi
quy tắc 4 là *"Đã làm"* trong khi quy tắc 3 được ghi trung thực là *"Đã làm ở mức máy"* — chênh
lệch đó làm người đọc bảng truy vết tin rằng quy tắc 4 đã kín.

**Sửa (ba phần, phần 1 và 3 là bắt buộc):**

1. Mở rộng `lib/safety/dosage-pattern.ts` thành **ba tầng**, giữ nguyên `findDosages()` là điểm vào
   duy nhất:
   ```ts
   const NUM = String.raw`(?:\d+(?:[.,]\d+)?|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|vài)`;
   // WEAK bổ sung các đơn vị thời gian / tần suất / dạng bào chế dùng trong kê liều:
   const WEAK = String.raw`(?:mg|ml|cc|g|IU|UI|mũi|liều|ngày|tuần|tháng|lần|viên|gói|%|ppm)`;
   /** Tầng PROTOCOL: không có số vẫn là phác đồ/lịch. Tính khi khớp VÀ không có HEDGE/REFERRAL
    *  trong cùng cửa sổ ±40 ký tự. */
   const PROTOCOL = /(phác đồ|liệu trình|lịch tiêm|lịch vaccine|lịch vắc\s?xin|nhắc lại|tiêm nhắc|liều nhắc)/i;
   const REFERRAL = /(bác sĩ thú y|người có thẩm quyền|chuyên gia thú y|liên hệ)/i;
   ```
   `findDosages()` trả về cả ba loại, mỗi mục kèm tầng đã khớp: `{ text: string; tier: 'strong' | 'weak' | 'protocol' }[]`.
2. `dosageIsGrounded()` giữ nguyên phép so chuỗi con cho `strong`/`weak`. Với mục `protocol`,
   so chuỗi con là vô nghĩa (không có con số để truy), nên quy tắc là: **mục `protocol` chỉ được
   coi là có căn cứ khi `approvedVetBasis(context)` khác rỗng**; kho không có căn cứ thú y đã duyệt
   ⇒ `false` ⇒ `guard_abort`. Ở bản demo điều này nghĩa là mọi phác đồ do LLM tự sinh đều bị huỷ —
   đúng hướng sai số mà §12.3 đã chọn (*"thà từ chối một câu trả lời đúng còn hơn phát một liều
   không có nguồn"*), và đúng ràng buộc cứng của dự án.
3. Thêm vào bộ ca test §19.1 (hai danh sách, để người sửa regex biết mình phá gì):
   - **Phải khớp:** `3 tuần tuổi, nhắc lại sau 4 tuần`, `2 lần/ngày`, `uống vài ngày`,
     `phác đồ 3 bước`, `tiêm nhắc lại`, `liệu trình kháng sinh`.
   - **Phải KHÔNG khớp:** `cai sữa 21 ngày`, `28 ngày tuổi`, `nái mang thai 114 ngày`,
     `theo dõi 2 tuần sau cai sữa`, `liên hệ bác sĩ thú y để được chỉ định phác đồ`
     (có `PROTOCOL` nhưng có `REFERRAL` trong cửa sổ ⇒ không tính).
4. Sửa §20 dòng Ch.10 q.4 thành *"Đã làm ở mức máy — bắt liều dạng số + đơn vị và các cụm phác
   đồ/lịch theo mẫu; không phải hiểu ngữ nghĩa"*, giống cách q.3 đã được ghi trung thực.

---

### R3-M1 — MEDIUM — `contextChunks` được ba cổng an toàn dùng nhưng **không được định nghĩa ở đâu**

**Ở đâu:** §12.3 (`refCitations = contextChunks...`), §12.3 (`mustBuffer = ... contextChunks.some(...)`),
§12.3 (`dosageIsGrounded(output, approvedVetBasis(contextChunks))`). Chuỗi `contextChunks` xuất hiện
6 lần trong toàn tài liệu, **cả 6 đều là chỗ dùng**; §5.4 không khai nó.

**Vấn đề:** [R2-M3] đã sửa đúng một nửa — nó chốt rằng căn cứ tính **từ context**, không phải từ
index. Nhưng "context" là gì thì còn ba cách hiểu, và chúng cho ba hành vi khác nhau:
(a) `pig_farming` + `cloud_farm` **sau** khi cắt ngân sách; (b) hai miền **trước** khi cắt ngân sách;
(c) chỉ miền thắng. Với (b), một chunk `approved` `PIG-07` bị bước 6 bỏ vì hết ngân sách vẫn
"hợp pháp hoá" một con số liều mà **LLM không hề nhìn thấy** và người dùng không thấy trong khối
trích dẫn — tái tạo đúng loại lỗ hổng mà [R2-M3] diệt, chỉ dịch sang một tầng khác. Với (c),
`mustBuffer` bỏ sót chunk `PIG-07` của miền kia.

**Sửa:** khai một kiểu + một hàm ở §5.4 và dùng đúng tên đó ở mọi chỗ:
```ts
/** Tập chunk THỰC SỰ vào prompt của lượt này: hợp của hai miền SAU khi đã cắt ngân sách (§11.3).
 *  Chỉ dùng cho guard an toàn và dựng citations — KHÔNG dùng để xếp hạng (bất biến #7). */
export type ContextChunks = RankedChunk[];
export function toContextChunks(r: RetrievalResult): ContextChunks {
  return [...r.pig_farming, ...r.cloud_farm];      // thứ tự: pig trước, tất định
}
```
Thêm một câu vào bất biến #7 (§15.3): việc hợp hai miền thành `ContextChunks` là **được phép** và
không vi phạm #7, vì nó không so điểm giữa hai miền; cấm duy nhất là **sắp xếp** hoặc **cắt** trên
danh sách hợp đó. Thêm ca unit test: một chunk `approved` `PIG-07` có liều bị loại ở bước cắt ngân
sách ⇒ `dosageIsGrounded()` vẫn trả `false` cho con số trong chunk đó.

---

### R3-M2 — MEDIUM — Chế độ `mustBuffer = false`: điều kiện huỷ nói là "liều **không truy ngược được**" nhưng phép kiểm được đặc tả chỉ là `findDosages()`; thứ tự "quét trước / phát sau" không được ghi

**Ở đâu:** §12.3 bảng "Hai chế độ phát, cùng một phép kiểm" (dòng `mustBuffer = false`) · §15.1
(dòng hậu kiểm `mustBuffer=false`) · §19.1 (`chat/stream.ts`).

**Vấn đề:** Cột "Cách phát" nói *"chạy `findDosages()` trên phần chưa phát"*, còn tiêu đề cột kế
bên nói *"Khi phát hiện liều **không truy ngược được**"*. Hai câu đó là hai phép kiểm khác nhau:

- Nếu hiện thực đúng chữ cột giữa ⇒ **mọi** mục liều trong đuôi làm huỷ câu trả lời, kể cả con số
  copy đúng từ một tài liệu `approved` ⇒ nhánh "có căn cứ ⇒ được phát" của [H1] không bao giờ đạt
  được ở chế độ không hoãn, và ca test tích hợp *"`approved` `PIG-07` chứa đúng liều đó ⇒ câu trả
  lời được phát"* chỉ còn đúng ở chế độ buffer.
- Nếu hiện thực đúng chữ cột phải ⇒ phải gọi `dosageIsGrounded(tail, approvedVetBasis(context))`,
  nhưng tài liệu không nói gọi trên **đuôi** hay trên **toàn bộ phần đã sinh**, cũng không nói
  chuẩn hoá có áp cho chuỗi bị cắt ngang mảnh hay không.

Thêm một chỗ hở về thứ tự: *"chỉ phát phần cách đuôi buffer ≥ 200 ký tự"* và *"sau mỗi mảnh nhận
được, chạy `findDosages()` trên phần chưa phát"* không nói việc nào làm trước. Nếu phát trước rồi
quét, một mảnh SSE dài hơn 200 ký tự sẽ đẩy phần đầu của chính nó ra client **trước khi** được quét.

**Sửa:** viết thành một vòng lặp tường minh trong §12.3, và đó là đặc tả để test:
```ts
// lib/chat/stream.ts — thứ tự BẮT BUỘC: nhận → quét → mới phát
buffer += chunk;                                   // 1. nhận
const unsent = buffer.slice(sentLen);              // 2. phần chưa phát (gồm cả mảnh vừa nhận)
if (!dosageIsGrounded(unsent, basis)) return abortGuard();   // 3. quét TOÀN BỘ phần chưa phát
const emitTo = Math.max(sentLen, buffer.length - HOLDBACK_CHARS);
emit(buffer.slice(sentLen, emitTo));               // 4. phát, luôn giữ lại 200 ký tự cuối
sentLen = emitTo;
```
Chốt thêm hai điều: phép kiểm ở cả hai chế độ là **`dosageIsGrounded`** (không phải `findDosages`
đơn thuần) — `findDosages` chỉ là thành phần bên trong nó; và `basis = approvedVetBasis(contextChunks)`
tính **một lần** trước khi mở stream. Ca test §19.1 phải có: liều **có căn cứ** ở chế độ
`mustBuffer=false` ⇒ **được phát** và `finish_reason === 'stop'`.

---

### R3-M3 — MEDIUM — Khối "cô lập / liên hệ thú y" của Ch.10 quy tắc 3 nửa (b) không có văn bản hằng, không có điểm chèn, và có thể tự làm guard huỷ câu trả lời

**Ở đâu:** §12.3 (*"code tự chèn … một khối cuối câu trả lời: hướng dẫn cô lập/giảm nguy cơ và liên
hệ thú y"*) · §12.2a (chỉ khai **bốn** hằng, không có hằng nào cho khối này) · §20 dòng "Ch.10 q.3
nửa bắt buộc" (ghi *"Đã làm"*).

**Vấn đề:** [R2-M6] đặt ra nguyên tắc đúng — văn bản tất định phải tồn tại dưới dạng hằng, có test
`toBe` từng chuỗi — nhưng khối của quy tắc 3(b) bị bỏ ngoài `messages.ts`. Nó là **yêu cầu cứng**
của đề án và được §20 ghi là đã làm, trong khi nội dung của nó hiện do người implement tự viết.
Tệ hơn, điểm chèn không được quy định so với `output-scan.ts`: nếu khối được nối vào `output`
**trước** khi quét, một câu rất tự nhiên trong khối như *"cô lập ô nuôi 14 ngày và liên hệ bác sĩ
thú y trước khi điều trị"* sẽ khớp `WEAK` (`ngày`) với `DRUG_CTX` (`điều trị`) trong cửa sổ ±40 ký
tự ⇒ `dosageIsGrounded()` trả `false` ⇒ **chính văn bản an toàn do code chèn làm huỷ toàn bộ câu
trả lời**, và người dùng mất luôn nửa (b) mà quy tắc 3 bắt buộc.

**Sửa:**
1. Thêm hằng thứ năm vào `lib/safety/messages.ts`, đặt tên `MSG_DIAGNOSIS_SAFETY`, có `title` +
   `steps: readonly string[]` + `action`, nội dung tiếng Việt chỉ gồm biện pháp không-thuốc (tách
   ô nuôi, hạn chế người/xe qua lại, giữ nước uống, ghi nhận số con có dấu hiệu) và câu liên hệ bác
   sĩ thú y. **Không chứa bất kỳ con số kèm đơn vị nào.**
2. Chốt điểm chèn: khối này được nối vào câu trả lời **SAU** khi `output-scan.ts` chạy xong và
   **không** đi qua `dosageIsGrounded()`.
3. Hai unit test: `findDosages(renderDiagnosisSafety()).length === 0` (chứng minh văn bản của ta
   không tự bắn guard), và `toBe` từng chuỗi của hằng.

---

### R3-M4 — MEDIUM — Danh mục `Notice` chưa đầy đủ: 4/6 mã chỉ có văn bản nằm rải trong văn xuôi, `COMMERCIAL_SOURCE` không có điều kiện phát cũng không có văn bản, và không nói ai viết `Notice.message`

**Ở đâu:** §5.4 (`Notice.code` 6 giá trị) · §11.5 (`CONFLICT_DETECTED`) · §12.3 (`NOT_A_DIAGNOSIS`) ·
§12.4 (`NO_CF_DOCS_NOTICE`) · §14.2 (ví dụ NDJSON có `IN_REVIEW_SOURCES`) · §16.2 (`EXPIRED_DOCS`
dưới dạng câu UI) · §12.2a (chỉ 4 hằng).

**Vấn đề:** `Notice.message` được khai là *"tiếng Việt, sẵn sàng hiển thị"*, tức server sinh. Nhưng:
`IN_REVIEW_SOURCES` chỉ xuất hiện trong một ví dụ JSON; `CONFLICT_DETECTED` và `NOT_A_DIAGNOSIS`
nằm trong văn xuôi §11.5/§12.3; `EXPIRED_DOCS` lại được mô tả như **câu của UI** ở §16.2
(*"Có {n} tài liệu liên quan nhưng đã hết hiệu lực…"*) — nên hai nơi cùng nhận trách nhiệm viết
một chuỗi. Và `COMMERCIAL_SOURCE` **không có điều kiện phát ở bất kỳ đâu**: §11.2 nói nguồn thương
mại chỉ được *gắn nhãn* trong khối trích dẫn, §16.2 cũng vậy ⇒ một giá trị enum chết, không test
được, và người implement sẽ tự nghĩ ra một điều kiện.

**Sửa:** chuyển cả 6 mã vào `lib/safety/messages.ts` thành một bảng duy nhất, mỗi mã có `level`,
`message` (hàm nhận tham số khi cần, ví dụ `EXPIRED_DOCS({n})`), và **điều kiện phát** ghi ngay
cạnh. Với `COMMERCIAL_SOURCE`, chọn một: **(a)** bỏ khỏi enum và giữ đúng cơ chế nhãn ở
`CitationBlock` (khuyến nghị — đúng chữ Ch.14 *"Đánh dấu nguồn thương mại"*), hoặc **(b)** giữ và
chốt điều kiện *"≥ 1 chunk vào context có `source_bias === 'commercial'`"* + văn bản + ca test.
Thêm một câu vào §16.2: component **không** tự viết chuỗi `Notice` nào; nó chỉ render
`notice.message` đến từ server (cùng nguyên tắc đã áp cho `GroundingNotice`).

---

### R3-M5 — MEDIUM — Điều kiện hiện `InReviewWarning` được viết là "mọi/bất kỳ" — hai quy tắc khác nhau trong cùng một dòng

**Ở đâu:** §16.2 dòng *"Cảnh báo tài liệu `in_review`"* (*"khi **mọi/bất kỳ** trích dẫn là
`in_review`"*) · §12.1 (hard rule chỉ chèn khi *"Mọi chunk đều `in_review`"*) · §14.2 (ví dụ phát
`notice` `IN_REVIEW_SOURCES`).

**Vấn đề:** "mọi" và "bất kỳ" là hai ngưỡng khác nhau. Ở bản demo không có tài liệu `approved` nào
nên hai cách hiểu trùng nhau — tức **lỗi này sẽ không bị phát hiện trong kiểm thử**, rồi lộ ra đúng
lúc chuyên gia duyệt xong vài tài liệu: một câu trả lời dựa 1 phần `approved` + 1 phần `in_review`
sẽ hoặc mất cảnh báo, hoặc có cảnh báo nói sai mức độ. Ch.3 (*"Tài liệu chưa xác minh không được
xem ngang hàng với tài liệu chính thức"*) đứng về phía "bất kỳ".

**Sửa:** chốt **"bất kỳ"** cho cảnh báo người dùng, giữ **"mọi"** cho hard rule trong prompt, và
phân biệt văn bản để không nói sai:
- ≥ 1 trích dẫn `in_review` ⇒ `Notice` `IN_REVIEW_SOURCES` cấp `warning`:
  *"{k}/{n} tài liệu được dẫn CHƯA được chuyên gia duyệt (in_review)."*
- **Mọi** chunk context là `in_review` ⇒ thêm hard rule §12.1 như hiện tại.
- Ca unit test: context có 1 `approved` + 1 `in_review` ⇒ **có** `Notice`, **không** có hard rule.

---

### R3-M6 — MEDIUM — Bảng phân bổ ngân sách prompt (§11.4) cộng ra 6100–6300 token trong khi `PROMPT_TOKEN_BUDGET_TOTAL` mặc định là 6000, và vi phạm chính quy tắc kiểm chéo mà §6.1 đặt ra

**Ở đâu:** §11.4 (bảng 5 cấu phần) · §6.1 (bảng khoảng hợp lệ, dòng `RETRIEVAL_CONTEXT_TOKEN_BUDGET`:
*"Phải nhỏ hơn `PROMPT_TOKEN_BUDGET_TOTAL` trừ các phần cố định; kiểm tra chéo ở `assertBudget`"*).

**Vấn đề:** 800 + 200 + 3500 + 1000 + 600 = **6100**; với system prompt ở đúng trần 1000 của nó thì
**6300**. Cả hai đều vượt 6000. Hệ quả theo đúng đặc tả `assertBudget`: **mọi** lượt chat có hội
thoại dài và context đầy sẽ bị **cắt bớt context** (từ chunk điểm thấp nhất lên) kèm một dòng `warn`
phát **một lần mỗi tiến trình** — tức trạng thái mặc định của hệ thống là âm thầm giảm căn cứ, và
dấu vết chỉ xuất hiện ở lượt đầu tiên. Ngoài ra phép kiểm chéo của §6.1 không thoả với chính giá
trị mặc định: 6000 − (1000 + 200 + 1000 + 600) = 3200 < 3500. Và §6.1 không nói kiểm chéo đó xảy ra
lúc nào: `assertBudget` là hàm **chạy mỗi request**, không phải bộ validate cấu hình.

**Sửa (chọn một, và sửa bảng cho cộng đúng):**
- **(a) khuyến nghị:** `PROMPT_TOKEN_BUDGET_TOTAL = 6500` (trần phần cố định 1000 + 200 + 600 =
  1800, cộng 3500 context + 1000 history = 6300, còn 200 token dự phòng cho ký tự nối và tiêu đề
  khối). Khoảng hợp lệ đổi thành 2500–30000.
- **(b)** giữ 6000 và hạ `RETRIEVAL_CONTEXT_TOKEN_BUDGET` mặc định xuống **3200**, sửa bảng §11.4
  và mọi con số 3500 ở §11.3 (1750/1750 → 1600/1600).

Và chốt nơi kiểm chéo: `getRetrievalConfig()` kiểm
`CONTEXT + HISTORY + SYSTEM_CAP + GLOSSARY_CAP + MESSAGE_CAP <= TOTAL` **lúc đọc env**; không thoả
⇒ dùng mặc định + `warn` một lần (cùng quy ước với các biến khác ở §6.1). `assertBudget` giữ vai
trò lưới an toàn lúc chạy, nhưng với cấu hình mặc định nó **không được** kích hoạt — thêm đúng ca
unit test đó: history 10 × 4000 ký tự + context đầy ⇒ `assertBudget` **không** cắt gì.

---

### R3-M7 — MEDIUM — Sơ đồ ingest §5.1 nói khác ba mục quy phạm: PII là cảnh báo, retry chỉ cho 429, L2-normalize là một bước của ingest

**Ở đâu:** §5.1 (sơ đồ luồng build kiến thức) vs §9.1 bước 7 + §4 ([M6]) vs §6.2 (retry 429 **và**
503) vs §6.3 + bất biến #2 (normalize ở **tầng adapter**).

**Vấn đề:** ba dòng trong sơ đồ:
1. `[quét PII (Ch.10 q.7)] ──► cảnh báo, hoặc lỗi nếu --strict` — trái §9.1 bước 7 và §4: PII là
   **lỗi cứng theo mặc định**, `--fail-on-pii` nằm trong lệnh `npm run ingest`. Đây là chỗ nguy
   hiểm nhất của finding này: repo đang public, và [M6] được viết ra chính để diệt cách hiểu
   "cảnh báo".
2. `[embedding theo batch + retry backoff khi 429]` — trái §6.2: retry cho **429 và 503** là bắt
   buộc, và 503 là trạng thái **thường gặp** theo số đo.
3. `[L2-normalize] ──► data/kb-index.json` — đặt normalize như một bước của ingest, trái bất biến
   #2 (*"Mọi vector đã L2-normalize — tầng cưỡng chế: **adapter embedding**"*). Đọc theo sơ đồ,
   người implement normalize ở `ingest.ts` và **đường query mất chuẩn hoá** — đúng cái bẫy
   0,592158 mà cả dự án xoay quanh.

Sơ đồ cũng thiếu bước 8 (kiểm thư mục CF), bước 11 (ba assertion tổng) và không thể hiện
`kb-vectors.bin` + `vectors_sha256` là đầu ra.

**Sửa:** viết lại §5.1 cho khớp 13 bước của §9.1, hoặc tốt hơn là **thay sơ đồ bằng một dòng dẫn
chiếu** *"Chuỗi bước chuẩn và duy nhất ở §9.1; sơ đồ dưới đây chỉ là hình minh hoạ, khi lệch thì
§9.1 thắng."* rồi sửa đúng ba dòng trên: `quét PII ⇒ LỖI CỨNG (mặc định)`,
`retry backoff khi 429 VÀ 503`, và bỏ hẳn hộp `L2-normalize` khỏi luồng ingest (thay bằng ghi chú
*"vector đã được normalize sẵn ở adapter"*).

---

### R3-M8 — MEDIUM — `excluded_expired`: trần 3 là "mỗi miền" hay "cả lượt"? Và việc sắp nó theo cosine giảm dần là một phép so điểm **giữa hai miền**

**Ở đâu:** §11.2 (câu dẫn: 8 bước *"thực hiện ĐỘC LẬP trong từng miền"*, bước 7 lấy *"tối đa 3 tài
liệu"*) vs §5.3 (`excluded_expired: CitationMeta[]`, *"dedupe theo `document_id`, tối đa 3"*) vs
§11.5 (`excluded_expired_count` … *"tối đa 3"*) vs §15.3 bất biến #7 (*"Điểm của hai miền **không
bao giờ** được so với nhau"*).

**Vấn đề:** nếu bước 7 chạy độc lập trong từng miền thì kết quả hợp lại có thể là **6** tài liệu,
trái hai chỗ ghi "tối đa 3". Nếu trần là 3 cho cả lượt thì phải **trộn hai miền rồi sắp theo cosine
giảm dần** — và đó chính là phép so điểm giữa hai miền mà bất biến #7 cấm. Cả hai cách đọc đều hợp
lệ với chữ hiện tại, và một trong hai vi phạm một bất biến được ghi là quy chuẩn.

**Sửa:** chốt **trần theo miền**, không trộn:
- Đổi `RetrievalResult.excluded_expired` thành `Record<Domain, CitationMeta[]>` (mỗi miền tối đa 3,
  sắp theo cosine giảm dần **trong miền**), đúng tinh thần `pig_farming`/`cloud_farm` tách field.
- `metrics.excluded_expired_count` = tổng hai miền (trần 6), và `per_domain` có thêm
  `excluded_expired: number`.
- §16.2 hiện theo miền, mỗi miền tối đa 3 + *"và {n} tài liệu hết hiệu lực khác"*.
- Thêm một câu vào bất biến #7: chỉ `ContextChunks` (R3-M1) được phép là danh sách hợp, và nó
  **không được sắp xếp lại**; mọi danh sách có thứ tự theo điểm đều phải thuộc **một** miền.
- Sửa `excluded_expired` trong ví dụ NDJSON §14.2 theo hình dạng mới.

---

### R3-M9 — MEDIUM — `superseded_by` không có tác dụng gì lúc truy xuất, nên một tài liệu đã bị thay thế vẫn có thể làm căn cứ chính

**Ở đâu:** §7.0 hệ quả 3 (ràng buộc bù của `07_Archived_Superseded`: `valid_to` đã qua **hoặc**
`superseded_by != null`) · §11.1 (chỉ hai lọc cứng: `rejected`, `domain`) · §11.2 (chỉ `expired`
theo `valid_to` bị tách nhánh) · §20 dòng Ch.14 (ghi biện pháp là *"`valid_to` filter,
`freshness_multiplier`, `superseded_by`"*).

**Vấn đề:** chữ "hoặc" trong ràng buộc bù cho phép một file nằm trong `07_Archived_Superseded/` có
`valid_to: null` và chỉ có `superseded_by: PIG-NUT-001`. Khi đó `expired = false`, nó đi qua lọc
cứng, có cosine, vào context, và được dẫn như căn cứ **hiện hành** — trong khi vị trí thư mục và
metadata của nó đều nói nó đã bị thay thế. Nếu nó còn là `approved` + `PIG-07` thì nó còn trở thành
`approvedVetBasis`, tức một liều thuốc đã bị thay thế được hợp pháp hoá. §20 đang tính
`superseded_by` là một biện pháp kiểm soát rủi ro Ch.14, nhưng không có dòng code nào đọc field đó.

**Sửa (chọn một, (a) khuyến nghị):**
- **(a)** Gộp vào cùng nhánh với `valid_to`: trong §11.2 bước 1,
  `expired = (valid_to != null && valid_to < now) || superseded_by != null`. Một tài liệu đã bị
  thay thế **không bao giờ** vào context, nhưng vẫn được báo trong `excluded_expired` khi liên quan
  — kèm `superseded_by` để UI nói được *"đã được thay thế bởi {id}"*. Thêm `superseded_by` vào
  `CitationMeta`.
- **(b)** Giữ nguyên hành vi và siết ràng buộc bù thành **AND** (`valid_to` đã qua **và**
  `superseded_by != null`), đồng thời xoá `superseded_by` khỏi ô biện pháp ở §20.

Ca test §19.1: chunk `superseded_by != null`, `valid_to: null`, cosine cao ⇒ **không** có trong
context; có trong `excluded_expired`.

---

### R3-M10 — MEDIUM — `grounding: 'insufficient'` không có ca test tích hợp nào, và quy tắc ghi đè ngưỡng về 0 khi dùng `mock` làm nó **không thể đạt được** khi chạy offline

**Ở đâu:** §6.1 [N2] + §6.5 (*"`RETRIEVAL_MIN_COSINE` **luôn** bị ghi đè về `0`"* khi
`EMBEDDING_PROVIDER=mock`) · §11.2 bước 2 (cổng: `cosine >= RETRIEVAL_MIN_COSINE`) · §19.2 (bảng ca
test tích hợp) · §18.2 (hai dòng `ask_for_more_data` / `out_of_scope`).

**Vấn đề:** mock dùng bag-of-words không âm, nên mọi cosine ≥ 0; với ngưỡng 0 thì **mọi** chunk qua
cổng liên quan. Hệ quả: khi chạy offline, `insufficient` chỉ đạt được nếu miền đang tìm **không có
chunk nào**, nên nhánh `insufficient` — tức nửa thứ hai của Ch.10 quy tắc 2, `MSG_INSUFFICIENT`,
và bảng chọn `ask_pig`/`ask_cf` theo `searched_domains` — **không có ca test tích hợp nào** trong
§19.2 và không thể có nếu giữ quy tắc ghi đè. Hai dòng eval `ask_for_more_data`/`out_of_scope` cũng
mất nghĩa, điều mà §18.2 có nói nhưng chỉ bằng nhãn *"chỉ dấu, không phải điểm"*.

**Sửa:**
1. Đổi quy tắc ghi đè: khi `EMBEDDING_PROVIDER=mock`, `RETRIEVAL_MIN_COSINE` bị ghi đè về
   **`MOCK_MIN_COSINE = 0.05`** (một hằng cạnh `MOCK_EMBEDDING_DIM`), không phải `0`. Lý do giữ
   nguyên như [N2] — phân bố điểm của mock không so được với embedding thật — nhưng một epsilon
   dương giữ cho nhánh "không liên quan" vẫn tồn tại ở chế độ offline.
2. Thêm hai ca vào §19.2: (a) câu hỏi hoàn toàn ngoài phạm vi (*"giá cổ phiếu hôm nay"*) ⇒
   `grounding === 'insufficient'`, **0 lần gọi LLM**, không có event `token`, `GroundingNotice`
   dùng đúng `MSG_INSUFFICIENT` với `ask_pig`; (b) `searched_domains` hai miền ⇒ danh sách `ask` có
   **6** mục, `ask_pig` trước.

---

### R3-M11 — MEDIUM — Bảng validate §8.1 thiếu hẳn 7 field mà §8 khai là có (trong đó `license_status` là **bắt buộc**), và không nói field nào được mang vào index

**Ở đâu:** §8 (frontmatter mẫu) vs §8.1 (bảng quy tắc validate) vs §5.4 (`IndexedChunk`) vs Ch.8
của đề án (*"language/translated_language"*, *"license_status"*).

**Vấn đề:** §8 khai `license_status` là **BẮT BUỘC** kèm enum 6 giá trị, nhưng §8.1 **không có dòng
nào** cho nó. Các field khác cũng vắng mặt khỏi bảng: `valid_from`, `superseded_by`,
`translated_language`, `translation_of`, `source_bias`, `quality_breakdown`, `tags`. Riêng
`translated_language` là metadata **tối thiểu theo Ch.8** và là cách Ch.3 (*"Lưu bản gốc, bản dịch
và liên kết giữa hai bản"*) được truy vết — nó xuất hiện đúng **một lần** trong toàn thiết kế, ở
ví dụ YAML, rồi biến mất: không có quy tắc validate, không có trong `IndexedChunk`, không có trong
`CitationMeta`. Vì vậy liên kết bản gốc ↔ bản dịch không thể hiện ra được ở khối trích dẫn, trong
khi §20 ghi Ch.3 "song ngữ có kiểm soát" là *"Đã làm"*.

**Sửa:**
1. Bổ sung đủ 7 dòng vào bảng §8.1, mỗi dòng có cột "Bắt buộc / Kiểu / Khi sai":
   `license_status` (bắt buộc, enum 6 giá trị, lỗi cứng); `valid_from` (tuỳ chọn, ISO date);
   `superseded_by` (tuỳ chọn, phải khớp regex `document_id`, và **phải trỏ tới một `document_id`
   tồn tại trong kho** — lỗi cứng nếu trỏ sai, cùng họ với kiểm trùng `document_id`);
   `translated_language` (tuỳ chọn, enum `vi|en`, phải khác `language`);
   `translation_of` (tuỳ chọn, phải tồn tại trong kho); `source_bias` (tuỳ chọn, `null|commercial`);
   `quality_breakdown` (bắt buộc khi `approved`, 6 khoá đúng tên Ch.9, tổng có trọng số phải khớp
   `quality_score` ±1); `tags` (tuỳ chọn, mảng chuỗi).
2. Thêm `translated_language`, `translation_of`, `superseded_by` vào `IndexedChunk` và
   `CitationMeta`, và một dòng ở §16.2: khi `translation_of != null`, `CitationBlock` hiện
   *"Bản dịch của {document_id}"*.
3. Thêm một câu vào §9.3 liệt kê **tường minh** các field frontmatter **cố ý không** mang vào index
   (`quality_score`, `quality_breakdown`, `tags`) kèm lý do — để lần sau không ai phải đoán xem
   thiếu là cố ý hay bỏ sót.

---

### R3-M12 — MEDIUM — `Ctx` (deadline) không có trong chữ ký `LlmChatRequest` lẫn `embedBatch`, dù §6.2 nói nó được truyền xuống **mọi** lệnh gọi mạng

**Ở đâu:** §5.3 (ba interface "xương sống") · §5.4 (`Ctx`) · §6.2 ([M10]: *"truyền `ctx` xuống
**mọi** lệnh gọi mạng: embedding câu hỏi, router tầng 2, chat, và cả lần hạ cấp sang
`:generateContent`"* + `canRetry(ctx, nextDelayMs, attemptTimeoutMs)`).

**Vấn đề:** `LlmChatRequest` chỉ có `signal?: AbortSignal`, `EmbeddingProvider.embedBatch(texts, kind)`
không có tham số thứ ba. `canRetry` cần **con số deadline**, không phải một `AbortSignal` — một
signal cho biết "đã hết giờ", không cho biết "còn 1,2 s nên đừng ngủ 8 s rồi thử lại", mà đó chính
là hành vi mà [M10] và ca test §19.1 (*"deadline còn 2s ⇒ không ngủ 8s"*) yêu cầu. Hiện thực theo
đúng §5.3 thì `lib/util/http.ts` không có đường nào lấy được deadline, và người implement sẽ dựng
một biến module-scope hoặc `AsyncLocalStorage` — hai lựa chọn khác nhau, cả hai đều không được đặc
tả, và biến module-scope thì sai trên serverless khi hai request dùng chung instance.

**Sửa:** đổi hợp đồng ở §5.3 cho khớp §6.2 (một dòng mỗi interface):
```ts
export interface LlmChatRequest { /* … */ ctx: Ctx; }          // thay cho signal?: AbortSignal
export interface EmbeddingProvider {
  embedBatch(texts: string[], kind: 'document' | 'query', ctx: Ctx): Promise<number[][]>;
}
```
`Ctx` giữ cả `signal` (để nút Dừng của UI vẫn huỷ được) và `deadline`. Ở `scripts/ingest.ts` —
nơi không có request HTTP — truyền `ctx = { requestId: 'ingest', deadline: Number.POSITIVE_INFINITY }`,
và nói rõ điều đó trong §9.1 bước 10 để không ai phải đoán.

---

### R3-M13 — MEDIUM — Hợp đồng `history` (10 × 4000 ký tự) và trần body 64 KB mâu thuẫn nhau: một client **tuân thủ đúng tài liệu** vẫn bị `400`, kèm thông báo nói sai nguyên nhân

**Ở đâu:** §14.2 (bảng request: `history` *"≤ 10 phần tử; mỗi phần tử `content: string ≤ 4000`"*,
và *"server lọc và cắt thay vì tin … **không** trả lỗi"*) vs §14 [R2-N7] (*"`content-length` >
64_000 ⇒ `400 INVALID_BODY`"*, và tự tính ra rằng payload hợp lệ có thể tới ~126 KB).

**Vấn đề:** hai mục cùng là quy phạm và chúng loại trừ nhau. §14 nhận ra điều này rồi chốt *"client
phải tự cắt trước khi gửi"*, nhưng **không nói cắt theo quy tắc nào**, trong khi §14.2 vẫn ghi
giới hạn 10 × 4000 ký tự như hợp đồng và còn nhấn mạnh `history` sai thì **lọc im, không trả lỗi**.
Hệ quả thực tế: một hội thoại dài bình thường (10 lượt, câu trả lời dài) vượt 64 KB vì tiếng Việt
3 byte/ký tự ⇒ server trả `400 INVALID_BODY` với message *"Câu hỏi không hợp lệ (quá dài / để
trống)"* — câu hỏi thì hợp lệ, và người dùng không có cách nào hiểu phải làm gì (§16.4 cũng không
có dòng nào cho tình huống này).

**Sửa:**
1. Sửa §14.2: hợp đồng client là **cắt `history` theo `HISTORY_TOKEN_BUDGET`** (1000 token ≈ 3.500
   ký tự theo heuristic của §9.2) **trước khi gửi**; giới hạn "10 phần tử / 4000 ký tự mỗi phần tử"
   được ghi lại đúng bản chất: **trần an toàn của server**, không phải mức được phép dùng hết.
2. Thêm quy tắc client vào §16.1: `ChatShell` cắt `history` bằng **cùng** hàm
   `trimByTokenBudget` dùng ở server (đặt nó ở `lib/util/tokens.ts` để hai phía dùng chung), và
   `useChatStream` kiểm `new TextEncoder().encode(body).length <= 64_000` trước khi `fetch`.
3. Tách mã lỗi để thông báo nói đúng nguyên nhân: giữ `INVALID_BODY` cho câu hỏi sai/JSON lỗi, thêm
   **`BODY_TOO_LARGE`** (`413`) với message *"Hội thoại quá dài. Hãy bấm 'Xoá hội thoại' rồi hỏi
   lại câu hỏi hiện tại."*, và một dòng tương ứng ở §16.4.

---

### R3-N1 — NIT — `answer_language='en'` không nói gì về bốn thông báo tất định tiếng Việt

**Ở đâu:** §14.2 (`answer_language: 'vi' | 'en'`) · §12.2a (bốn hằng tiếng Việt, test `toBe` từng
chuỗi) · §16.2 (`GroundingNotice` render nguyên văn các hằng đó).

**Vấn đề:** người dùng chọn "English" rồi gặp trạng thái `refused_vet_safety` sẽ nhận một khối
tiếng Việt. Đây có thể là quyết định đúng (toàn bộ nội dung hướng tới người dùng cuối của dự án là
tiếng Việt), nhưng tài liệu không nói, nên người implement có thể tự thêm bản `en` và làm test
`toBe` đỏ.

**Sửa:** thêm một câu vào §12.2a: *"`answer_language` chỉ ảnh hưởng ngôn ngữ phần do LLM sinh. Bốn
thông báo tất định luôn là tiếng Việt, vì người đọc chúng là nhân viên và quản lý trại; không tạo
biến thể `en`."* Và một ca test chốt: `answer_language='en'` + `refused_vet_safety` ⇒ vẫn đúng
`MSG_REFUSED_VET`.

---

### R3-N2 — NIT — Ba trạng thái không gọi LLM không có `finish_reason` nào đúng nghĩa

**Ở đâu:** §14.2 (`finish_reason ∈ stop | length | error | aborted | guard_abort`) · §12.2 (ba
trạng thái *"không gọi LLM"*) · §18.2 (eval chấm `refuse_vet_safety` bằng `grounding` **hoặc**
`finish_reason`).

**Vấn đề:** với `insufficient` / `no_cf_docs` / `refused_vet_safety` (chặn ở lớp 1) thì không có
lần sinh nào, nên `stop` nói sai (không có gì "kết thúc bình thường") và `guard_abort` cũng sai
(không có gì bị huỷ). `usage.chunks_used` cũng không được định nghĩa cho các trạng thái này.

**Sửa:** thêm giá trị **`refused`** vào enum `finish_reason`, dùng cho cả ba trạng thái tất định,
và ghi ở §14.2: `usage.chunks_used = 0` khi `finish_reason === 'refused'`. Giữ `guard_abort` riêng
cho trường hợp đã sinh rồi bị huỷ, vì eval và UI phân biệt hai việc đó.

---

### R3-N3 — NIT — `vectors_file` chỉ có trong ví dụ JSON, không có trong kiểu; đường dẫn `.bin` không nói resolve theo cái gì

**Ở đâu:** §9.3 (ví dụ index có `"vectors_file": "kb-vectors.bin"`) · §5.4 (`LoadedIndex.embedding`
không có field đó) · §6.1 (`KB_INDEX_PATH=./data/kb-index.json`) · §9.4 (`outputFileTracingIncludes`
ghi cứng `./data/...`).

**Sửa:** thêm `vectors_file: string` vào `LoadedIndex.embedding` ở §5.4, và chốt quy tắc:
đường dẫn `.bin` = `path.join(path.dirname(KB_INDEX_PATH), embedding.vectors_file)`. Thêm một câu
cảnh báo ở §6.1: đổi `KB_INDEX_PATH` ra ngoài `./data/` sẽ làm `outputFileTracingIncludes` (§9.4)
không còn đóng gói đúng file ⇒ `INDEX_MISSING` trên Vercel; vì vậy biến này chỉ nên đổi khi tự host.

---

### R3-N4 — NIT — `/api/logout` nằm ngoài matcher và ngoài rate limit; `/api/health` kích hoạt nạp index + sha256 mà không cần đăng nhập

**Ở đâu:** §13.3 (matcher `['/', '/api/chat']`) · §13.4 (bảng rate limit chỉ có login và chat) ·
§14.3 (`health` *"dùng để kiểm tra sau deploy mà không cần đăng nhập"*) · §9.4 (`getIndex()` kiểm
`sha256` của `.bin`).

**Vấn đề:** cả hai đều tác động nhỏ — `logout` chỉ xoá cookie (và `sameSite: 'lax'` đã chặn phần
lớn POST cross-site), `getIndex()` có cache ở module scope nên chỉ lần đầu mỗi instance là tốn. Nhưng
cả hai là endpoint công khai không có giới hạn nào, và `health` còn phơi số chunk + tên model.

**Sửa:** áp `RATE_LIMIT_CHAT` (hoặc một giới hạn riêng rộng hơn, ví dụ `60/5m`) cho `/api/health`
và `/api/logout` bằng cùng `lib/auth/rate-limit.ts`; thêm `Cache-Control: no-store` cho cả hai. Ghi
một câu ở §14.3 rằng việc để `health` công khai là **quyết định có ý thức** (để nghiệm thu sau
deploy khi chưa có mật khẩu) và nó chỉ trả số đếm, không trả nội dung tài liệu.

---

### R3-N5 — NIT — Tài liệu pháp luật đã duyệt không thể làm căn cứ thú y, trái thứ tự ưu tiên của Ch.10 quy tắc 6

**Ở đâu:** §12.3 (`approvedVetBasis`: `category === 'PIG-07'`) · §7.0 (`PIG-LEGAL`,
`doc_kind: legal_regulation`) · §12.1 (prompt ghi *"quy định pháp luật còn hiệu lực > SOP nội bộ >
hướng dẫn chung"*).

**Vấn đề:** một văn bản pháp luật về tiêm phòng bắt buộc (nếu được nạp vào `03_Vietnam_Legal/` và
`approved`) mang `category: 'PIG-LEGAL'`, nên **không** được tính là căn cứ ⇒ hệ thống từ chối một
lịch vaccine có hiệu lực pháp luật. Hướng sai số là từ chối quá tay nên **không nguy hiểm**, nhưng
nó ngược với thứ tự ưu tiên mà chính prompt dặn LLM.

**Sửa:** chọn một và ghi lý do: **(a)** giữ nguyên `PIG-07` và thêm một câu ở §12.3 rằng đây là
giới hạn có ý thức của bản này (*"căn cứ thú y chỉ tính nhóm Thú y đã duyệt; văn bản pháp luật
được dẫn như nguồn nhưng không mở cổng liều"*), hoặc **(b)** mở thành
`category === 'PIG-07' || doc_kind === 'legal_regulation'` kèm ca test. Không để ngỏ, vì
`03_Vietnam_Legal/` sẽ có nội dung thật trước `02_Cloud_Farm/`.

---

### R3-N6 — NIT — Ba artifact được ingest sinh ra nhưng không có hình dạng: `stats.skipped`, `data/glossary.json`, `data/ingest-report.json`

**Ở đâu:** §5.4 (`IndexStats.skipped`) · §9.1 bước 12 · §9.5 · §7.4 (*"Sinh `data/glossary.json` để
prompt dùng"*).

**Vấn đề:** `skipped` không nói đếm cái gì (file bị loại trừ ở bước 1? tài liệu `rejected`? file
lỗi?) — mà §19.2 lại dùng *"báo cáo đúng số file/chunk"* làm tiêu chí nghiệm thu, nên một con số
không có định nghĩa sẽ được lấy làm mục tiêu. Hai file JSON kia cũng không có schema, dù
`glossary.json` được `lib/kb/glossary.ts` đọc ở đường nóng và `ingest-report.json` là nơi lưu vết
`--allow-pii --reason` theo [M6].

**Sửa:** chốt ba định nghĩa, mỗi cái một dòng: `skipped` = **số file `.md` bị loại vì
`verification_status: rejected`** (không tính file bị loại trừ ở bước 1 — những file đó không bao
giờ được quét); `glossary.json` = `{ version: 1, terms: Array<{ vi, en, abbr, unit, note, group }> }`
(đúng 6 cột của bảng §7.4, đã chuẩn hoá sẵn khoá khớp để không phải chuẩn hoá lại mỗi request);
`ingest-report.json` = `{ ingested_at, duration_ms, stats: IndexStats, warnings: string[], pii_policy, flags: string[] }`.
Thêm zod schema cho `glossary.json` ở `lib/kb/schema.ts` vì nó được **đọc lúc chạy**.

---

## Kiểm tra hồi quy: 21 finding vòng 2 có thật sự được sửa?

Đọc ngược từng finding của `design-review.json` vòng 2 vào văn bản vòng 3:

| Finding vòng 2 | Dấu vết trong design.md | Kết luận |
|---|---|---|
| R2-H1 (hậu kiểm chỉ chạy khi gắn cờ) | §1 nguyên tắc, §12.3 `mustBuffer` 4 điều kiện + hai chế độ phát, §16.4 quy tắc xoá nội dung, §19.2 hai ca mới | ✅ Đã sửa (còn hai chỗ chưa khép: R3-M2 về phép kiểm ở chế độ không hoãn, R3-H2 về phạm vi nhận diện) |
| R2-H2 (router loại hẳn miền CF) | §10 `CF_OPERATION_LEXICON` + quy tắc tầng 1 mới + `cfSignal`, §19.2 ba ca | ⚠️ Sửa **chưa khép**: quy tắc "vẫn tìm CF" không có field nào chở — xem R3-H1 |
| R2-M1 (bất biến #3 lạc hậu) | §15.3 dòng dẫn + bất biến #3 viết lại | ✅ |
| R2-M2 (thứ tự ưu tiên grounding) | §12.0 mới, 7 bước + chuỗi ưu tiên | ✅ |
| R2-M3 (`approvedBasis` từ đâu) | §12.3 `approvedVetBasis(context)` + bảng 4 cách hiểu | ⚠️ Sửa **chưa khép**: `context`/`contextChunks` vẫn không có định nghĩa — R3-M1 |
| R2-M4 (mẫu liều rời rạc) | §12.3a module `dosage-pattern.ts`, hai tầng + cửa sổ ±40, bộ ca test | ⚠️ Sửa đúng hướng nhưng **phạm vi hẹp hơn quy tắc 4** — R3-H2 |
| R2-M5 (`excluded_expired` không đo liên quan) | §11.1 bảng 3 điều, §11.2 bước 3 và 7, §11.5, §19.2 hai ca | ⚠️ Còn vướng trần 3 per-miền / toàn lượt — R3-M8 |
| R2-M6 (văn bản tất định) | §12.2a bốn hằng + bảng chọn `ask` | ⚠️ Thiếu khối quy tắc 3(b) và 6 mã `Notice` — R3-M3, R3-M4 |
| R2-M7 (thứ tự xếp hạng) | §11.2 tám bước có số, §11.3 6a/6b/6c | ✅ |
| R2-M8 (`cfScore >= pigScore` khi 0/0) | §10 `cfSignal`, §12.4 ba nhánh | ✅ (nhưng `cfSignal` chỉ hữu dụng nếu CF được tìm — R3-H1) |
| R2-M9 (trích dẫn khi từ chối) | §12.3 `refCitations` + §16.2 tiêu đề riêng | ✅ |
| R2-M10 (`/api/health` thiếu trong tracing) | §9.4 thêm khoá `/api/health`, §17.1 bước 5 | ✅ |
| R2-M11 (thiếu Bước 0) | §17.1 Bước 0 + cấm commit index `mock` + message `INDEX_MISSING` mới | ✅ |
| R2-N1…R2-N8 | §17.3, §5.4 `AnimalStage`, §9.1 bước 1, §5.4 `CitationMeta.score`, §6.1 bảng 11 dòng, §18.1, §14 trần 64 KB, §17.2 | ✅ cả tám (riêng N7 mở ra mâu thuẫn mới với §14.2 — R3-M13) |

Không có finding vòng 2 nào bị bỏ hoặc backlog. Bốn finding được xử lý khác chữ đề xuất (R2-H2,
R2-M5, R2-N1, R2-N8) đều có lý do ghi tại chỗ, và ba trong bốn lý do đó là **đúng hơn** đề xuất
của review vòng 2 — đặc biệt việc đổi `CitationMeta.score` thành `number` không-nullable và việc
bác định nghĩa `cfSignal` mà vòng 2 đề xuất (vì nó đúng cả ở nhánh `fallback` 0/0).

## Những chỗ **không** nên sửa khi xử lý review này

Vòng 3 có một số quyết định dễ bị "cải thiện" sai trong lúc sửa 15 finding ở trên. Giữ nguyên:
L2-normalize ở **tầng adapter** cho cả `document` và `query` rồi dùng dot product; `normalized: true`
chỉ ghi sau khi đo lại 5 vector; `GEMINI_FALLBACK_MODELS` để trống; validate API key chỉ `min(1)`;
chặn `rejected` ở hai tầng; `RetrievalResult` tách hai field; ba trạng thái `grounding` không gọi
LLM; năm mã lỗi nhà cung cấp AI phân biệt được "chờ" / "gọi IT"; lịch sử hội thoại không bao giờ là
căn cứ; `expected_answer` luôn `null`; trích xuất 7 quy tắc Ch.10 so từng ký tự kèm
`toHaveLength(7)`; `Ch.9` cưỡng chế bằng ba ràng buộc liên-field ở ingest; `PATH_TAXONOMY` là bảng
hằng duy nhất; không có đường nào từ HTTP ghi file vào `knowledge/` hay `data/` (bất biến #11);
chế độ `TRUSTED_PROXY=false` dùng một bộ đếm dùng chung thay vì tin header.

Đặc biệt: **không** nới `findDosages` theo hướng giảm báo động giả. Hai HIGH ở trên đều yêu cầu
**mở rộng** phạm vi chặn, và hướng sai số "từ chối quá tay" là hướng đúng cho nội dung thú y.
