# Kế hoạch hiện thực hoá — Chatbot AI nội bộ trang trại lợn & Cloud Farm

> **Thiết kế đã chốt.** Tài liệu này KHÔNG thiết kế lại. Nó sắp xếp công việc theo thứ tự
> phụ thuộc, nêu file sẽ tạo/sửa và cách xác minh từng hạng mục.
>
> Đầu vào theo đúng thứ tự ưu tiên: `docs/de-an-chatbot-cloud-farm.txt` (đề án — nguồn chân
> lý nghiệp vụ) → `.agents/tasks/design.md` (đặc tả hiện thực, 2.746 dòng, 22 mục) →
> `.agents/tasks/design-review.json` (21 finding vòng 3 — **danh sách việc phải làm**) →
> `.agents/tasks/design-review.md` → `.agents/HANDOFF.md` → `.kiro/steering/project-environment.md`.

---

## 0. Quy tắc phân định khi tài liệu tự mâu thuẫn

Bốn quy tắc dưới đây áp cho **mọi** hạng mục trong kế hoạch. Khi phải dùng tới chúng, ghi
quyết định + lý do vào `docs/MAPPING.md`.

1. **Trường `fix` trong `design-review.json` THẮNG văn bản hiện tại của `design.md`.**
   Văn bản design.md là bản vòng 3 *trước* khi review vòng 3 được xử lý, nên mọi chỗ review
   chỉ ra là chỗ design.md còn sai.
2. **Trong `design.md`: mục quy phạm thắng sơ đồ minh hoạ.** Cụ thể: **§9.1 (13 bước ingest)
   thắng sơ đồ §5.1**; **bảng bất biến §15.3 thắng văn xuôi**, trừ khi review nói ngược.
3. **Không giải được ⇒ chọn phương án AN TOÀN HƠN** (từ chối trả lời, chặn nhiều hơn, fail
   cứng thay vì cảnh báo), ghi quyết định + lý do vào `docs/MAPPING.md`. **Không** chọn
   phương án dễ code hơn.
4. **Mâu thuẫn ảnh hưởng hành vi an toàn mà không chắc ⇒ DỪNG và hỏi orchestrator** bằng
   `send_message` severity `warning`. Không đoán.

### 0.1 Các phương án đã chốt sẵn theo quy tắc trên (không mở lại)

| Finding | Chọn | Căn cứ |
|---|---|---|
| R3-M4 `COMMERCIAL_SOURCE` | **(a)** Bỏ khỏi enum `Notice.code` (còn **5** mã), giữ đúng cơ chế **nhãn** ở `CitationBlock` | Khuyến nghị của `fix`; đúng chữ Ch.14 *"Đánh dấu nguồn thương mại"* |
| R3-M6 ngân sách prompt | **(a)** `PROMPT_TOKEN_BUDGET_TOTAL = 6500`, khoảng hợp lệ **2500–30000** | Khuyến nghị của `fix`; giữ nguyên 3500 context nên không giảm căn cứ |
| R3-M9 `superseded_by` | **(a)** Gộp vào cùng nhánh `expired` | Khuyến nghị của `fix`, **và** là phương án chặn nhiều hơn (quy tắc 3) |
| R3-N5 căn cứ thú y | **(a)** Giữ `category === 'PIG-07'`, ghi rõ là giới hạn có ý thức | Quy tắc 3: từ chối quá tay là hướng sai số đúng cho nội dung thú y |

---

## 1. Môi trường thi hành — đọc trước khi chạy lệnh đầu tiên

Các dữ kiện này **đã kiểm chứng trên máy này**, đừng khám phá lại (`.kiro/steering/project-environment.md`):

- Shell là **PowerShell trên Windows**. Nối lệnh bằng `;`, **không** `&&`. Dùng `$env:VAR`,
  **không** `%VAR%`.
- **`npm.ps1` bị ExecutionPolicy chặn.** Mọi lệnh npm phải gọi **`npm.cmd`** (ví dụ
  `npm.cmd run test`) hoặc `cmd /c npm ...`. Đây là lý do README phải ghi rõ việc này.
- Script `.ps1` phải gọi `powershell -NoProfile -ExecutionPolicy Bypass -File "<path>"`.
- Shell thường trả **`Exit Code: -1` kể cả khi thành công** và echo lệnh rất nhiễu. **Không**
  dùng exit code của shell làm bằng chứng. Với lệnh dài: ghi ra `.ps1`, cho script ghi log ra
  file, rồi đọc file log.
- **Các bước workflow KHÔNG chạy bất kỳ lệnh git nào.** "Commit" nghĩa là: lưu file lên đĩa,
  rồi ghi một dòng mô tả mốc vào `.agents/tasks/CHANGELOG-NO-GIT.md`. Orchestrator sở hữu git.
- **Không có API key** trong môi trường bước workflow (có chủ ý, §21.2). Mọi xác minh chạy
  với `LLM_PROVIDER=mock` + `EMBEDDING_PROVIDER=mock`. **Tuyệt đối không commit index sinh
  bằng mock vào `data/`** (§17.1) — nó làm production trả `INDEX_PROVIDER_MISMATCH` cho mọi
  câu hỏi trong khi repo trông như đã có index. Index mock chỉ tồn tại ở `tests/fixtures/`.
- **Không hard-code API key, không ghi key vào bất kỳ file nào, không in key ra log.** Nếu
  cần debug thì chỉ in 6 ký tự đầu.

---

## 2. Lệnh xác minh chuẩn của dự án

Mọi hạng mục dưới đây dùng đúng các lệnh này (khai trong `package.json`, hạng mục 1):

| Lệnh | Dùng để |
|---|---|
| `npm.cmd run typecheck` | `tsc --noEmit` — hợp đồng kiểu giữa các tầng là trung tâm thiết kế |
| `npm.cmd run test` | `vitest run` — toàn bộ unit + integration |
| `npm.cmd run test -- <đường dẫn>` | Chạy đúng một file/thư mục test của hạng mục vừa làm |
| `npm.cmd run lint` | `next lint` |
| `npm.cmd run build` | `next build` — chốt chặn cuối, bắt lỗi Edge/Node và import sai |
| `npm.cmd run fixtures` | Sinh `tests/fixtures/kb-index.fixture.json` + `.bin` tất định |
| `npm.cmd run ingest -- --dry-run` | Chạy 13 bước ingest không gọi API, không ghi file |
| `npm.cmd run eval` | Chấm bộ test Ch.11 (chạy được với mock) |

**Một hạng mục chỉ được coi là xong khi lệnh xác minh của nó chạy thật và đạt kết quả nêu
trong hạng mục.** Grep không phải xác minh.

---

## 3. Kế hoạch — danh sách có thứ tự

### Khối A — Nền tảng (hạng mục 1–8)

- [ ] **1. Dựng scaffold Next.js 15 + toàn bộ file cấu hình build, và SỬA HAI FILE REPO BẮT BUỘC.**
      Tạo `package.json` (đúng 9 script của §4, `engines.node >= 20.9.0`), `tsconfig.json`
      (`strict: true`, alias `@/*`), `next.config.ts` (`outputFileTracingIncludes` **top-level**
      cho cả `/api/chat` và `/api/health` theo §9.4, `output: 'standalone'`),
      `tailwind.config.ts` + `postcss.config.mjs` (Tailwind **3.4.x** + `@tailwindcss/typography`),
      `vitest.config.ts`, `.env.example`, `app/globals.css`, `app/layout.tsx` (`<html lang="vi">`).
      Dependency đúng §3: `next@15`, `react@19`, `gray-matter@4`, `js-yaml@4` (direct), `zod@3`,
      `react-markdown@9`, `remark-gfm@4`; dev: `typescript@5`, `tsx`, `vitest@3`,
      `@tailwindcss/typography`. **KHÔNG thêm** `rehype-raw`, `ai`/`@ai-sdk/*`, `@google/genai`,
      `better-sqlite3`, `tiktoken`, `iron-session`/`jose`/`next-auth`.
      **Hai thay đổi repo bắt buộc, làm ngay trong hạng mục này:**
      (a) **Bỏ dòng `data/kb-index.json`** (và dòng ghi chú `# prebuilt knowledge-base index
      (decision pending: commit or not)`) khỏi `.gitignore`; **không** thêm `data/kb-vectors.bin`;
      giữ nguyên các dòng `.env*.local`.
      (b) **Tạo `.gitattributes`** đúng 3 dòng của §6.3b: `* text=auto eol=lf`,
      `data/kb-vectors.bin binary`, `*.bin binary`.
      Files: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`,
      `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `app/layout.tsx`,
      `app/globals.css`, `.gitignore` (sửa), `.gitattributes` (mới).
      Verify: `npm.cmd install` xong; `npm.cmd run typecheck` pass;
      `Select-String -Path .gitignore -Pattern 'kb-index'` trả **0 dòng**;
      `Get-Content .gitattributes` hiện đúng 3 dòng.

- [ ] **2. Kiểm chứng 4 giả định kỹ thuật của §21.2 NGAY SAU `npm install`, trước khi viết UI/middleware.**
      Bốn hạng mục `CHƯA KIỂM` là biên bảo mật/cấu hình, kiểm sai thì phải sửa lại nhiều:
      (i) `react-markdown@9` **không** render raw HTML khi thiếu `rehype-raw` (chống XSS, §3);
      (ii) `outputFileTracingIncludes` ở **top-level** `next.config.ts` của Next 15 (§9.4);
      (iii) `NextRequest.ip` đã bị bỏ ở Next 15 (quyết định cách lấy IP, §13.4);
      (iv) trần `maxDuration` của Vercel Hobby — nếu **khác 60s** thì sửa **đúng một** hằng
      `DEADLINE_MS = trần − 10s`, không sửa chỗ khác.
      Ghi kết quả thật (kèm phiên bản package đã cài) vào `.agents/tasks/verify-gemini.md`.
      Files: `.agents/tasks/verify-gemini.md` (bổ sung mục).
      Verify: `npm.cmd run build` pass (chứng minh (ii) đúng — nếu sai, Next cảnh báo option
      không nhận); mục mới trong `verify-gemini.md` ghi rõ 4 kết luận + phiên bản package.

- [ ] **3. `lib/kb/types.ts` — toàn bộ kiểu dùng chung (§5.4), đã áp 8 finding.**
      Khai một chỗ duy nhất: `Domain`, `Category` (gồm `PIG-GLOSSARY`, `PIG-LEGAL`), `DocKind`,
      `VerificationStatus`, `AnimalStage` (8 giá trị), `ExclusionFlag`, `Grounding` (5 giá trị),
      `RiskFlag`, `IndexedChunk`, `RankedChunk`, `CitationMeta`, `RetrievalMetrics`, `Notice`,
      `ChatMeta`, `LoadResult`, `LoadedIndex`, `IndexStats`, `RateLimitResult`, `Ctx`.
      Các sửa bắt buộc so với văn bản §5.4:
      • **R3-M1**: thêm `export type ContextChunks = RankedChunk[]` và
        `export function toContextChunks(r: RetrievalResult): ContextChunks` =
        `[...r.pig_farming, ...r.cloud_farm]`, kèm docstring *"tập chunk THỰC SỰ vào prompt của
        lượt này: hợp hai miền SAU khi đã cắt ngân sách (§11.3); chỉ dùng cho guard an toàn và
        dựng citations, KHÔNG dùng để xếp hạng"*.
      • **R3-M8**: `RetrievalResult.excluded_expired` đổi thành
        `Record<Domain, CitationMeta[]>` (mỗi miền tối đa 3); `RetrievalMetrics.per_domain`
        thêm `excluded_expired: number`; `excluded_expired_count` = tổng hai miền (trần 6).
      • **R3-M11**: `IndexedChunk` và `CitationMeta` thêm `translated_language`,
        `translation_of`, `superseded_by`.
      • **R3-M12**: `LlmChatRequest` có **`ctx: Ctx`** (bỏ `signal?: AbortSignal`);
        `EmbeddingProvider.embedBatch(texts, kind, ctx)`. `Ctx` giữ cả `signal` (nút Dừng) và
        `deadline` (số).
      • **R3-N2**: `finish_reason` thêm giá trị **`'refused'`** (dùng cho cả 3 trạng thái tất
        định); ghi quy ước `usage.chunks_used = 0` khi `finish_reason === 'refused'`.
      • **R3-N3**: `LoadedIndex.embedding` thêm `vectors_file: string`.
      • **R3-M4**: `Notice.code` còn **5** mã (`IN_REVIEW_SOURCES`, `EXPIRED_DOCS`, `NO_CF_DOCS`,
        `CONFLICT_DETECTED`, `NOT_A_DIAGNOSIS`) — bỏ `COMMERCIAL_SOURCE`.
      Files: `lib/kb/types.ts`, `lib/llm/types.ts`, `lib/embedding/types.ts`.
      Verify: `npm.cmd run typecheck` pass (file kiểu không có runtime nên typecheck là xác
      minh đúng tầng).

- [ ] **4. `lib/config/env.ts` — đọc env lazy, KHÔNG throw lúc import, + kiểm chéo ngân sách.**
      `getLlmConfig()`, `getEmbeddingConfig()`, `getAuthConfig()`, `getRetrievalConfig()` trả
      `ConfigResult<T>`. Validate API key **chỉ `z.string().min(1)`** — không regex tiền tố,
      không ép độ dài (key thật dạng `AQ.Ab8...` 53 ký tự). `SESSION_SECRET` < 32 ký tự ⇒
      `CONFIG_MISSING` với message nêu rõ yêu cầu độ dài. Bảng 11 khoảng hợp lệ §6.1: ngoài
      khoảng ⇒ **dùng mặc định + log `warn` một lần, không throw**. `RATE_LIMIT_*` theo regex
      `/^(\d{1,4})\/(\d{1,4})([smh])$/`.
      Các sửa bắt buộc:
      • **R3-M6**: `PROMPT_TOKEN_BUDGET_TOTAL` mặc định **6500**, khoảng **2500–30000**. Và
        **kiểm chéo LÚC ĐỌC ENV** trong `getRetrievalConfig()`:
        `CONTEXT + HISTORY + SYSTEM_CAP + GLOSSARY_CAP + MESSAGE_CAP <= TOTAL`
        (3500 + 1000 + 1000 + 200 + 600 = 6300 ≤ 6500 ✔); không thoả ⇒ dùng mặc định + `warn`
        một lần. `assertBudget` giữ vai trò lưới an toàn **lúc chạy** và với cấu hình mặc định
        **không được kích hoạt**.
      • **R3-M10**: khi `EMBEDDING_PROVIDER=mock`, `RETRIEVAL_MIN_COSINE` bị ghi đè về hằng
        **`MOCK_MIN_COSINE = 0.05`** (không phải 0), log `info` một lần. Số chiều vẫn luôn
        `MOCK_EMBEDDING_DIM = 256`.
      • **R3-N3**: thêm cảnh báo cho `KB_INDEX_PATH` — đổi ra ngoài `./data/` làm
        `outputFileTracingIncludes` không đóng gói đúng file ⇒ `INDEX_MISSING` trên Vercel.
      Files: `lib/config/env.ts`, `tests/unit/config/env.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/config` pass, gồm các ca: thiếu key ⇒
      `{ok:false}` **không throw**; `AQ.`-53 **và** `AIza`-39 đều pass; `RETRIEVAL_TOP_K=0`,
      `=21`, `SESSION_TTL_HOURS=0`, `CHUNK_MIN_TOKENS > CHUNK_MAX_TOKENS`,
      `LLM_ATTEMPT_TIMEOUT_MS=60000` đều ⇒ mặc định + `warn` một lần; `SESSION_SECRET` 31 ký
      tự ⇒ `{ok:false}` message chứa "ít nhất 32 ký tự"; **ca kiểm chéo ngân sách**: tổng 5
      cấu phần vượt `TOTAL` ⇒ dùng mặc định + `warn`.

- [ ] **5. `lib/util/*` — tiện ích dùng chung, trong đó `http.ts` là nơi chính sách retry sống.**
      `tokens.ts` (`ceil(chars/3.5)` + **`trimByTokenBudget`** — hàm này **dùng chung cho cả
      server và client**, xem R3-M13 ở hạng mục 24), `cosine.ts` (dot product thuần),
      `ndjson.ts` (encode/decode, xử lý dòng bị cắt giữa hai mảnh TCP), `ids.ts`, `logger.ts`
      (log một lần mỗi tiến trình cho các cảnh báo cấu hình), `http.ts`.
      `http.ts` phải có: retry cho **429, 500, 502, 503, 504** và lỗi mạng/timeout; **không**
      retry `400/401/403/404`; tối đa 4 lần thử trên model chính; backoff 1→2→4→8s jitter ±20%;
      ưu tiên header `Retry-After`; và **`canRetry(ctx, nextDelayMs, attemptTimeoutMs)`** với
      `RESERVE_MS = 3000` đọc `ctx.deadline` (R3-M12 — `ctx` là tham số, **không** dùng biến
      module-scope hay AsyncLocalStorage: biến module-scope **sai** trên serverless khi hai
      request dùng chung instance).
      Files: `lib/util/{tokens,cosine,ndjson,ids,logger,http}.ts`, `tests/unit/util/*.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/util` pass, gồm: retry đúng status và **không**
      retry 400/401/403; tôn trọng `Retry-After`; **`canRetry` với deadline còn 2s KHÔNG ngủ
      8s rồi thử lại** mà trả ngay mã lỗi của lần thử cuối (fake timers); tổng thời gian chuỗi
      retry không bao giờ vượt deadline; NDJSON khứ hồi + một dòng bị cắt giữa hai mảnh vẫn
      parse đúng; `tokens` không trả 0 cho chuỗi không rỗng.

- [ ] **6. `lib/embedding/*` — và đây là nơi bất biến #2 được thiết lập (R3-M7).**
      `types.ts` (đã làm ở hạng mục 3), `gemini.ts`, `openai-compatible.ts`, `mock.ts`,
      `index.ts` (factory có **hai** cách gọi: `forIngest(env)` lấy model/dim từ env,
      `forQuery(indexMeta, env)` lấy `model` + `dim` **từ metadata index**, env chỉ cấp
      provider/key/baseUrl).
      Yêu cầu cứng:
      • **`l2normalize()` chạy Ở TẦNG ADAPTER, trên MỌI vector, ở CẢ `kind:'document'` VÀ
        `kind:'query'`, bất kể số chiều** — **KHÔNG** normalize trong `scripts/ingest.ts`
        (R3-M7: sơ đồ §5.1 đặt sai chỗ; bất biến #2 §15.3 thắng). Nếu chỉ normalize lúc ingest
        thì vector câu hỏi vẫn có chuẩn 0,592158 và RAG xếp hạng sai tài liệu **không crash,
        không log**.
      • Assertion cứng `vectors.length === texts.length` (lệch ⇒ throw, huỷ cả lần ingest).
      • Map `kind` → `taskType`: `document` → `RETRIEVAL_DOCUMENT`, `query` → `RETRIEVAL_QUERY`.
      • Gửi `outputDimensionality`; ghi **số chiều THỰC TẾ đo được** từ response đầu tiên.
      • Fallback key `EMBEDDING_API_KEY ?? GEMINI_API_KEY` **chỉ khi** provider là `gemini` —
        đây là **yêu cầu bắt buộc hiện thực**, thiếu nó thì bản deploy không trả lời được câu nào.
      • `mock.ts`: hằng `MOCK_EMBEDDING_ID='mock'`, `MOCK_EMBEDDING_MODEL='mock-bow-hash-v1'`,
        `MOCK_EMBEDDING_DIM=256`, **không** đọc `EMBEDDING_DIMENSION`; bag-of-words hash rồi
        L2-normalize (để test truy xuất offline có tương đồng từ vựng thật).
      • `embedBatch(texts, kind, ctx)` — truyền `ctx` xuống `http.ts` (R3-M12).
      Files: `lib/embedding/{gemini,openai-compatible,mock,index}.ts`,
      `tests/unit/embedding/*.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/embedding` pass, gồm: fixture mô phỏng vector
      chuẩn **0,592** (đúng số đo thật) ⇒ sau adapter `|v| = 1 ± 1e-6` ở **cả hai** `kind`;
      `vectors.length !== texts.length` ⇒ throw; mock deterministic (2 lần gọi cùng vector),
      `|v| ≈ 1`, văn bản trùng từ vựng có cosine cao hơn văn bản không liên quan; mock giữ
      `dim=256` **dù** `EMBEDDING_DIMENSION=768` (có `warn`); `forQuery` lấy model/dim từ index
      kể cả khi env đặt khác.

- [ ] **7. `lib/llm/*` — adapter chat, có đường hạ cấp khi SSE lỗi.**
      `gemini.ts`: auth **query param `?key=`** (Bearer trả 401 — cấm dùng); map role
      `assistant → model`; parse SSE `data: {...}` lấy `candidates[0].content.parts[*].text`;
      **bỏ part có cờ `thought`**, không bao giờ đẩy reasoning ra UI; gửi `thinkingConfig` chỉ
      khi `GEMINI_THINKING_LEVEL` khác rỗng và nếu API trả 400 về field đó thì thử lại **đúng
      một lần** không kèm field, `warn` một lần.
      **§6.2.1 hạ cấp:** thử `:streamGenerateContent?alt=sse` trước; hết retry mà không mở được
      stream **và** `GEMINI_ALLOW_NONSTREAM_FALLBACK=true` ⇒ tự gọi `:generateContent` rồi phát
      ra client theo từng mảnh nhỏ qua **đúng** giao thức NDJSON cũ, chỉ đặt
      `meta.streaming=false`. Cả hai đường thất bại ⇒ `502 LLM_UNAVAILABLE`.
      `openai-compatible.ts` theo §6.4 (gồm nhánh Ollama loopback cho phép key rỗng).
      `mock.ts`: hằng `MOCK_LLM_ID`/`MOCK_LLM_MODEL`; marker `__MOCK_EMIT_DOSAGE__` và
      `__MOCK_EMIT_DIAGNOSIS__` để test guard; phát từng từ với `await sleep(15)`.
      Files: `lib/llm/{gemini,openai-compatible,mock,index}.ts`, `tests/unit/llm/*.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/llm` pass, gồm: map `assistant → model`; part có
      cờ `thought` bị bỏ; **SSE lỗi ⇒ tự gọi `generateContent`** và vẫn phát đúng chuỗi event
      NDJSON với `meta.streaming === false`; `GEMINI_ALLOW_NONSTREAM_FALLBACK=false` ⇒ báo lỗi
      thay vì hạ cấp.

- [ ] **8. Ghi mốc Khối A vào `CHANGELOG-NO-GIT.md`.**
      Một dòng mô tả: scaffold + hai thay đổi repo + types + env + util + hai họ adapter, kèm
      ghi chú rằng L2-normalize nằm ở tầng adapter (R3-M7). **Không chạy lệnh git.**
      Files: `.agents/tasks/CHANGELOG-NO-GIT.md`.
      Verify: `npm.cmd run typecheck` và `npm.cmd run test` pass trên toàn bộ Khối A.

---

### Khối B — Kho kiến thức và ingest (hạng mục 9–16)

- [ ] **9. `lib/kb/schema.ts` — `PATH_TAXONOMY` (23 khoá) + zod frontmatter §8.1 đã bổ sung 7 field.**
      Bảng hằng `PATH_TAXONOMY` phủ **đủ 23 thư mục** có thể chứa `.md` theo §7.0, cộng
      `PATH_CHECK_EXEMPT = ['07_Archived_Superseded']`. `buildFrontmatterSchema({ now }: { now: Date })`
      — **đồng hồ là tham số**, không gọi `Date.now()` bên trong (nếu không, test đổi kết quả
      theo ngày chạy).
      **R3-M11 — bổ sung đủ 7 dòng vào bảng validate** (đây là phần design.md còn thiếu):
      | Field | Bắt buộc | Quy tắc | Khi sai |
      |---|---|---|---|
      | `license_status` | **Có** | enum 6 giá trị (`internal_draft`/`internal_approved`/`public_domain`/`permitted`/`needs_review`/`restricted`) | **Lỗi cứng** |
      | `valid_from` | Không | ISO date | Lỗi cứng nếu sai kiểu |
      | `superseded_by` | Không | khớp regex `document_id` **VÀ** phải trỏ tới một `document_id` **tồn tại trong kho** | **Lỗi cứng** nếu trỏ sai |
      | `translated_language` | Không | enum `vi`\|`en`, **phải khác** `language` | Lỗi cứng |
      | `translation_of` | Không | phải tồn tại trong kho | Lỗi cứng |
      | `source_bias` | Không | `null` \| `commercial` | Lỗi cứng |
      | `quality_breakdown` | **Khi `approved`** | 6 khoá đúng tên Ch.9, tổng có trọng số khớp `quality_score` **±1** | Lỗi cứng |
      | `tags` | Không | mảng chuỗi | Cảnh báo |
      Giữ nguyên 3 ràng buộc liên-field Ch.9 (`approved` ⇒ có `reviewer`, `quality_score >= 85`,
      `exclusion_flags` rỗng) và quy tắc ngày **không ở tương lai**.
      Thêm zod schema cho `data/glossary.json` (R3-N6) vì file này được đọc ở **đường nóng**.
      Files: `lib/kb/schema.ts`, `tests/unit/kb/schema.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/kb/schema.test.ts` pass, gồm: `PATH_TAXONOMY`
      đủ **23** khoá; thư mục lạ ⇒ lỗi; `PIG-GLOSSARY`/`PIG-LEGAL` hợp lệ; file trong
      `07_Archived_Superseded` thiếu **cả** `valid_to` quá hạn **và** `superseded_by` ⇒ lỗi;
      quy tắc ngày với `vi.setSystemTime('2026-11-05')`: `2026-11-01` pass / `2026-11-06`
      fail (**kết quả không đổi theo ngày chạy**); `animal_stage` giá trị lạ ⇒ **cảnh báo**;
      **7 ca mới cho 7 field R3-M11**, trong đó `superseded_by` trỏ tới id không tồn tại ⇒
      lỗi cứng, và `quality_breakdown` lệch `quality_score` > 1 ⇒ lỗi cứng.

- [ ] **10. `lib/kb/chunk.ts` + `lib/kb/glossary.ts`.**
      `chunk.ts` theo §9.2: cắt theo heading `##`/`###` giữ `heading_path`; section >
      `CHUNK_MAX_TOKENS` (512) tách theo ranh giới đoạn với chồng lấn 64; section <
      `CHUNK_MIN_TOKENS` (80) gộp với section kế cùng cấp; **bảng Markdown không bị cắt giữa
      bảng** (cho chunk vượt mức thay vì cắt đôi — bảng cắt đôi là vô dụng, đúng tinh thần Ch.9);
      `chunk_id = <document_id>#<3 chữ số>`; `content_hash = sha256(text)`.
      `glossary.ts`: nạp `data/glossary.json`, khớp theo quy tắc §5.4 — `NFD` → bỏ dấu phụ →
      `toLowerCase()` → khớp **theo biên từ**, **ưu tiên cụm dài nhất**, tối đa **10** cặp.
      Files: `lib/kb/{chunk,glossary}.ts`, `tests/unit/kb/{chunk,glossary}.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/kb/chunk.test.ts tests/unit/kb/glossary.test.ts`
      pass, gồm: bảng Markdown **không** bị cắt đôi; `chunk_id` tất định; `"fcr"` khớp `"FCR"`;
      **`"nái"` KHÔNG khớp trong `"khoái"`**; `"nái hậu bị"` thắng và không trả thêm `"nái"`;
      trần 10 cặp.

- [ ] **11. Cây thư mục kiến thức theo Phụ lục A + `knowledge/02_Cloud_Farm/` RỖNG NỘI DUNG + cảnh báo repo public.**
      Tạo **đúng** cây Phụ lục A (gốc đổi tên `knowledge/`), thư mục rỗng giữ bằng `.gitkeep`:
      `01_Pig_Farming/01..12`, `02_Cloud_Farm/01..07`, `03_Vietnam_Legal/{Animal_Husbandry,Veterinary,Environment}`,
      `04_Bilingual_Glossary/`, `05_Expert_Reviewed_QA/`, `06_Test_Dataset/`, `07_Archived_Superseded/`,
      `_sources/`.
      **`knowledge/02_Cloud_Farm/` phải có đầy đủ 7 thư mục con nhưng KHÔNG một file nội dung
      nào** (Ch.2.2: không được tự tạo tên menu, chức năng, trường dữ liệu hay quy trình).
      **Cơ chế bảo vệ repo public số 1 — khối cảnh báo ở NGAY ĐẦU
      `knowledge/02_Cloud_Farm/README.md`**, trước mọi nội dung khác, đúng nội dung §7.1: repo
      đang PUBLIC, mọi file đặt vào đây sẽ công khai trên internet, **phải chuyển repo sang
      private hoặc tách kho kiến thức TRƯỚC KHI thêm tài liệu thật đầu tiên**, chuyển sau là
      không kịp vì fork/clone/cache đã giữ bản sao; căn cứ Ch.10 quy tắc 7 và Ch.14. Phần dưới
      README là checklist tối thiểu để một tài liệu CF được nạp (có phiên bản phần mềm, có
      người duyệt là key user, có ngày rà soát).
      Files: `knowledge/**/.gitkeep`, `knowledge/02_Cloud_Farm/README.md`.
      Verify: `Get-ChildItem knowledge -Recurse -Directory | Measure-Object` khớp cây Phụ lục A;
      `Get-ChildItem knowledge/02_Cloud_Farm -Recurse -Filter *.md` trả **đúng một** file
      (`README.md`); 5 dòng đầu của README chứa khối cảnh báo chế độ repo.

- [ ] **12. 12 tài liệu mẫu + 2 fixture kiểm thử + glossary ≥ 25 mục — nội dung GỐC, tự soạn.**
      12 tài liệu tiếng Việt ngắn đúng bảng §7.3 (3 × PIG-05 Nutrition, 3 × PIG-11 KPI,
      3 × PIG-09 Biosecurity, 3 × PIG-02 Reproduction). Mọi file: frontmatter đầy đủ Ch.8,
      **`verification_status: in_review`**, **`reviewer: null`**, `source: "Nội bộ – bản thảo
      demo"`, `source_url: null`, `license_status: internal_draft`,
      **`publication_date: 2026-11-01`** và **`last_reviewed: 2026-11-01`** (đồng hồ máy là
      2026-11-05, ngày tương lai là lỗi cứng), và **dòng cảnh báo ngay dưới frontmatter**:
      *"⚠️ BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT… không dùng làm căn cứ kỹ thuật hay thú y
      cho đến khi chuyên gia chăn nuôi / bác sĩ thú y có thẩm quyền rà soát và chuyển
      `verification_status` sang `approved`"*.
      **Nội dung cố tình TRÁNH mọi liều thuốc, phác đồ, lịch vaccine** (Ch.10 q.4) — kể cả
      `PIG-BIO-002` về sát trùng cũng chỉ nêu nguyên tắc và nhóm hoạt chất, **không** nêu nồng
      độ pha. **KHÔNG crawl, KHÔNG copy nội dung** từ Merck/PIC/Kansas State/WOAH/FAO.
      Hai fixture (là **hạ tầng kiểm thử**, không phải tài liệu kiến thức — ghi rõ trong
      `docs/MAPPING.md`): `PIG-NUT-004` ở `07_Archived_Superseded/` (`valid_to` đã qua,
      `superseded_by: PIG-NUT-001`) và `PIG-NUT-005` ở `05_Nutrition/` (còn hiệu lực,
      `in_review`, nêu **một con số khác** `PIG-NUT-001` cho **cùng giai đoạn**, dùng **đúng
      cùng chuỗi heading** `## Nhu cầu dinh dưỡng` → `### Giai đoạn nursery` để
      `conflict_detected` thực sự nổ; thân bài nói rõ nó tồn tại để kiểm thử).
      `04_Bilingual_Glossary/glossary.md`: bảng Markdown **≥ 25 mục**, 6 cột
      `Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm`, phủ ADG, FCR, tỷ lệ
      chết, tỷ lệ đẻ, số con cai sữa, nái hậu bị, nái mang thai, nái nuôi con, grower, finisher,
      nursery, sữa đầu, an toàn sinh học, sát trùng, phác đồ, cai sữa, động dục, phối giống, lứa,
      số con sơ sinh sống, trọng lượng cai sữa, năng suất nái, PSY, khẩu phần, thức ăn hỗn hợp,
      cách ly, tiêu huỷ, thông gió, mật độ nuôi. `document_id: PIG-GLO-001`,
      `category: PIG-GLOSSARY`.
      Files: 12 file `.md` dưới `knowledge/01_Pig_Farming/{02,05,09,11}_*/`,
      `knowledge/01_Pig_Farming/05_Nutrition/PIG-NUT-005.md`,
      `knowledge/07_Archived_Superseded/PIG-NUT-004.md`,
      `knowledge/04_Bilingual_Glossary/glossary.md`.
      Verify: hạng mục 14 (`npm.cmd run ingest -- --dry-run` ⇒ 0 lỗi validate, `files === 15`).
      Kiểm ngay trong hạng mục này: `(Select-String -Path knowledge/04_Bilingual_Glossary/glossary.md -Pattern '^\|' | Measure-Object).Count`
      ≥ 27 (25 mục + header + dòng phân cách).

- [ ] **13. `knowledge/_sources/sources.yaml` (12 nguồn Phụ lục B) + `knowledge/06_Test_Dataset/qa-seed.jsonl`.**
      `sources.yaml`: đúng **12** mục Phụ lục B với đúng URL (Merck trang chủ + Feeding Levels
      + Preventive Health, PIC Resources + Nutrition Guidelines Metric, KSU Swine Nutrition
      Guide, WOAH ASF + CSF, FAO, Cổng văn bản Chính phủ, vbpl.moj.gov.vn, FAOLEX). Mỗi mục:
      `id, name, url, owner, language, topics, license_status, priority, notes`.
      **`license_status: needs_review` cho CẢ 12 mục** — đây là **danh mục**, không phải nội
      dung; Phụ lục B yêu cầu kiểm điều khoản sử dụng *trước khi* thu thập.
      `qa-seed.jsonl`: **6 nhóm Ch.11, mỗi nhóm 4–6 câu**; `group` ∈ `nutrition |
      veterinary_disease | care_reproduction | biosecurity | production_kpi | cloud_farm`;
      `expected_behavior` ∈ 7 giá trị §18.1. **`expected_answer` LUÔN là `null`** — Ch.11 cấm
      lấy câu trả lời do chatbot tạo làm đáp án chuẩn; cột này **để trống chờ chuyên gia điền**.
      Phủ **đủ 7 loại `hard_case` bắt buộc**, mỗi loại ≥ 1 câu: `conflicting_docs`,
      `outdated_doc`, `missing_data`, `out_of_scope`, `veterinary_risk`, `cloud_farm_no_doc`,
      `cloud_farm_mixed`. Bổ sung theo R3-M10: một câu `out_of_scope` thật rõ (ví dụ *"giá cổ
      phiếu hôm nay"*).
      Files: `knowledge/_sources/sources.yaml`, `knowledge/06_Test_Dataset/qa-seed.jsonl`.
      Verify: `npm.cmd run test -- tests/unit/kb/qa-seed.test.ts` pass, gồm: **mọi** dòng có
      `expected_answer === null`; đủ 6 `group`, mỗi group 4–6 câu; đủ **7** giá trị `hard_case`;
      `sources.yaml` có **12** mục và **12/12** `license_status === 'needs_review'`.

- [ ] **14. `scripts/ingest.ts` — 13 bước của §9.1 (§9.1 THẮNG sơ đồ §5.1), + cơ chế bảo vệ repo public số 2.**
      Đúng thứ tự 13 bước. Ba chỗ sơ đồ §5.1 nói **sai**, phải làm theo §9.1 (**R3-M7**):
      • **Bước 7 quét PII là LỖI CỨNG theo mặc định** (`--fail-on-pii` nằm ngay trong lệnh npm):
        `exit 1`, **không ghi index**, in **đường dẫn file + LOẠI PII**, **không in giá trị**.
        Bỏ qua phải tường minh `--allow-pii --reason "<lý do>"`; thiếu `--reason` thì
        `--allow-pii` **bị từ chối**; lý do ghi vào `data/ingest-report.json`.
      • **Retry backoff cho 429 VÀ 503** (không chỉ 429) — 503 là trạng thái **thường gặp**
        theo số đo.
      • **KHÔNG có bước L2-normalize trong ingest** — vector đã được normalize sẵn ở adapter
        (hạng mục 6, bất biến #2).
      Bước 8 = **cơ chế bảo vệ repo public số 2**: nếu `knowledge/02_Cloud_Farm/**` có file
      `.md` nào **khác `README.md`** ⇒ in cảnh báo nổi bật **không tắt được**, liệt kê từng
      file, nhắc **kiểm tra chế độ repo (public/private) trước khi commit**. **Không chặn
      ingest** — tài liệu CF thật là thứ ta mong có, chỉ phải chắc repo đã private trước đó.
      Bước 1 loại trừ: `_sources/**`, mọi `README.md`, `*.template.md`,
      **`05_Expert_Reviewed_QA/**`**, **`06_Test_Dataset/**`**.
      Bước 11 có **5 assertion** trước khi ghi (ba tổng `by_*` = `chunks`,
      `vectors.length === chunks × dimension`, và **chuẩn L2 của 5 vector lấy mẫu = 1 ± 0,001
      trước khi ghi `normalized: true`**). Bước 12 ghi **nguyên tử** (`.tmp` rồi `rename`).
      Bước 10 truyền `ctx = { requestId: 'ingest', deadline: Number.POSITIVE_INFINITY }` (R3-M12).
      **R3-N6 — chốt ba định nghĩa còn thiếu:** `stats.skipped` = **số file `.md` bị loại vì
      `verification_status: rejected`** (không tính file bị loại trừ ở bước 1, vì những file đó
      không bao giờ được quét); `data/glossary.json` =
      `{ version: 1, terms: Array<{ vi, en, abbr, unit, note, group }> }` (đúng 6 cột §7.4, đã
      chuẩn hoá sẵn khoá khớp); `data/ingest-report.json` =
      `{ ingested_at, duration_ms, stats, warnings: string[], pii_policy, flags: string[] }`.
      Cờ: `--fail-on-pii`, `--allow-pii --reason`, `--strict`, `--dry-run` (đúng 4 mục, không
      thêm cờ nghịch `--no-reuse-vectors`).
      Files: `scripts/ingest.ts`, `lib/kb/pii.ts`, `tests/integration/ingest.test.ts`.
      Verify: `npm.cmd run ingest -- --dry-run` trên `knowledge/` thật ⇒ **0 lỗi validate**,
      `files === 15`, ba tổng `by_*` bằng nhau và bằng `chunks`. Rồi
      `npm.cmd run test -- tests/integration/ingest.test.ts` pass, gồm: file thiếu
      `document_id` ⇒ exit 1 **không ghi index**; file chứa email/số điện thoại ⇒ exit 1, log
      có **loại** PII nhưng **không có giá trị**; `--allow-pii` thiếu `--reason` ⇒ exit 1;
      `02_Cloud_Farm/` có file `.md` ⇒ **in cảnh báo, không chặn**; file `.md` ở thư mục ngoài
      `PATH_TAXONOMY` ⇒ exit 1; `.md` dưới `05_Expert_Reviewed_QA/` ⇒ **0 lỗi** và không nằm
      trong `stats.files`; đồng hồ giả `2026-11-05` ⇒ 0 lỗi ngày.

- [ ] **15. `scripts/make-fixtures.ts` — fixture tất định cho test tích hợp.**
      Sinh `tests/fixtures/kb-index.fixture.json` + `tests/fixtures/kb-vectors.fixture.bin`
      (mock 256 chiều, đã L2-normalize, `sha256` khớp `vectors_sha256` trong JSON). Nội dung
      đủ 6 tài liệu: 1 **approved `PIG-07` CÓ mẫu liều trong text**, 1 approved `PIG-09`
      **không** liên quan thuốc, 2 `in_review`, 1 **`rejected`**, 1 **hết hiệu lực**, cộng
      **cặp mâu thuẫn** cùng `category` + cùng `heading_path`. Bổ sung cho các finding mới:
      1 chunk có **`superseded_by != null` và `valid_to: null`** (R3-M9) và 1 chunk `in_review`
      `PIG-07` **có mẫu liều** (R2-M9/R3-H2).
      Files: `scripts/make-fixtures.ts`, `tests/fixtures/*`.
      Verify: `npm.cmd run fixtures` rồi chạy lại ⇒ **hai file không đổi một byte nào** (test
      chốt so byte + so hash); `npm.cmd run test -- tests/unit/scripts/make-fixtures.test.ts` pass.

- [ ] **16. Ghi mốc Khối B vào `CHANGELOG-NO-GIT.md`.**
      Files: `.agents/tasks/CHANGELOG-NO-GIT.md`.
      Verify: `npm.cmd run test` pass toàn bộ; `npm.cmd run ingest -- --dry-run` ⇒ 0 lỗi.

---

### Khối C — Truy xuất và định tuyến (hạng mục 17–19) — **đóng R3-H1**

- [ ] **17. `lib/kb/store.ts` — nạp index, 5 kiểm tra, không throw.**
      Singleton cache module-scope, nạp lười. `getIndex(): Promise<LoadResult>` — **không
      throw**, trả discriminated union 4 mã lỗi. Năm kiểm tra theo thứ tự §9.4, mỗi lỗi có
      **thông báo tiếng Việt**: file tồn tại → `schema_version` khớp →
      `sha256(kb-vectors.bin)` khớp `vectors_sha256` → `vectors_bytes === chunks × dim × 4` →
      **`embedding.provider` khớp `EMBEDDING_PROVIDER` hiện tại** (`INDEX_PROVIDER_MISMATCH`).
      **Kiểm tra #5 chỉ so `provider`, KHÔNG so `embedding_model`/`dimension` với env** —
      bất biến #13 và R2-M1: so với env là tái tạo đúng lỗi *"local chạy tốt, production 503
      mọi câu hỏi"*.
      **R3-N3**: đường dẫn `.bin` = `path.join(path.dirname(KB_INDEX_PATH), embedding.vectors_file)`.
      Files: `lib/kb/store.ts`, `tests/unit/kb/store.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/kb/store.test.ts` pass, gồm: trả đúng **4** mã
      lỗi; provider lệch ⇒ `INDEX_PROVIDER_MISMATCH`; `forQuery` lấy model/dim **từ index** kể
      cả khi env đặt khác; `.bin` sửa 1 byte ⇒ `INDEX_CORRUPT`.

- [ ] **18. `lib/kb/router-domain.ts` — router 2 tầng, và BỎ trách nhiệm `searched_domains` khỏi router (R3-H1).**
      `RouterResult { domains, method, confidence, pigScore, cfScore, cfSignal }`.
      Cây quyết định §10: người dùng chọn miền ≠ "Tự động" ⇒ `method='user'`; tầng 1 từ vựng
      có trọng số (tên nhóm = 3, thuật ngữ glossary = 2, `CF_OPERATION_LEXICON` = 2, từ chung
      = 1), khớp **theo biên từ** sau NFD + bỏ dấu, **ưu tiên cụm dài nhất**; cả hai = 0 ⇒
      `'both'`/`fallback` (**không** gọi tầng 2); `min > 0` ⇒ **tìm cả hai**/`lexical`;
      `min = 0 && max >= 4` ⇒ chỉ miền thắng; `min = 0 && max >= 2` ⇒ chỉ miền thắng;
      `min = 0 && max = 1` ⇒ tầng 2 (LLM một lượt, timeout 5s, lỗi ⇒ `'both'`/`llm_failed`).
      `CF_OPERATION_LEXICON` đúng 36 chuỗi §10 — **từ vựng về việc dùng một phần mềm**, tuyệt
      đối **không** chứa tên menu/nút/trường/phân hệ nào của Cloud Farm (Ch.2.2, Ch.10 q.5);
      không được thêm chuỗi như vậy kể cả sau khi có manual thật.
      `cfSignal = cfScore > 0 || ((method === 'user' || method === 'llm') && domains.includes('cloud_farm'))`
      — **cố ý loại** `fallback` và `llm_failed` (hai nhánh đó mở miền CF vì an toàn, không vì
      bằng chứng).
      **R3-H1 phần (3) — BỎ dòng "VẪN thêm `cloud_farm` vào `searched_domains`" khỏi cây §10.**
      Router **KHÔNG sở hữu** `searched_domains`; cây §10 chỉ kết luận `domains` + `cfSignal`.
      Cache LRU 200 mục theo câu hỏi đã chuẩn hoá.
      Files: `lib/kb/router-domain.ts`, `tests/unit/kb/router-domain.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/kb/router-domain.test.ts` pass, gồm: câu có dấu
      và không dấu; `user` override thắng; cả hai điểm = 0 ⇒ `both`/`fallback` và **spy LLM
      đếm 0 lần**; `min=0 && max=1` ⇒ **có** gọi tầng 2; tầng 2 timeout ⇒ `both`/`llm_failed`;
      *"xem FCR ở đâu trong phần mềm"* ⇒ `cfScore >= 2`; `"nut"`/`"mat khau"` không dấu vẫn
      khớp; `cfSignal` đúng 5 ca (true khi `cfScore>0`, khi `user`+CF, khi `llm`+CF; **false**
      khi `fallback` và `llm_failed`); **và một test tĩnh chốt `RouterResult` KHÔNG có field
      `searched_domains`**.

- [ ] **19. `lib/kb/retrieve.ts` + `lib/kb/rank.ts` — 8 bước tất định, và `retrieve()` TỰ TÍNH `searched_domains` (R3-H1).**
      **Đây là hạng mục đóng finding HIGH R3-H1.** Đổi chữ ký thành
      `retrieve({ now, queryVec, index, router }: { now: Date; queryVec: Float32Array; index: LoadedIndex; router: RouterResult })`
      và bên trong tự tính:
      ```ts
      const cfEmptyStore = index.stats.by_domain.cloud_farm === 0;
      const searched = [...new Set([
        ...router.domains,
        ...((router.cfSignal || cfEmptyStore) ? ['cloud_farm'] : []),
      ])];
      ```
      Chỉ **chấm điểm thật** cho miền có chunk; **miền rỗng vẫn được ghi vào `searched_domains`**
      (tìm trên kho rỗng tốn 0ms, nên không có lý do hiệu năng để bỏ).
      Lọc cứng §11.1: `rejected` (lớp phòng thủ 2) và `domain` không thuộc miền đang tìm.
      **R3-M9**: `expired = (valid_to != null && valid_to < now) || superseded_by != null` —
      tài liệu đã bị thay thế **không bao giờ** vào context nhưng **vẫn được báo** trong
      `excluded_expired` kèm `superseded_by` để UI nói *"đã được thay thế bởi {id}"*.
      8 bước §11.2 đúng thứ tự: tính điểm (gồm cả chunk `expired`) → cổng liên quan trên
      **cosine thuần** → tách nhánh `expired` → sắp 3 tầng (`final_score` ↓, `cosine` ↓,
      `chunk_id` ↑) → **trần theo tài liệu CHẠY TRƯỚC top-K** → top-K rồi cắt ngân sách **bỏ
      từ CUỐI lên** → nhánh hết hiệu lực → kết luận.
      `rank.ts`: `final_score = cosine × status_multiplier × freshness_multiplier`
      (`approved`=1.0, `in_review`=0.75; ≤24 tháng=1.0, 24–48=0.9, >48=0.8). `source_bias`
      **không** đổi điểm. `doc_kind` **không** tham gia lọc và **không** đổi điểm.
      **R3-M8**: `excluded_expired` là `Record<Domain, CitationMeta[]>` — **trần 3 THEO MIỀN**,
      sắp cosine giảm dần **trong miền**, **không trộn hai miền**;
      `metrics.excluded_expired_count` = tổng hai miền (trần 6); `per_domain` thêm
      `excluded_expired: number`.
      **R3-H1 phần (4)**: đầu vào của phép chia ngân sách §11.3 là **`searched_domains`**
      (không phải "miền có kết quả"); với CF rỗng thì bước **6c** trả phần dư nên PIG vẫn nhận
      tới 3500 token. Ba bước con 6a/6b/6c đúng thứ tự cố định, `leftover` tính **một lần**,
      mỗi miền cắt lại **nhiều nhất một lần**, `pig_farming` trước.
      `metrics` theo §11.5: `candidate_count`/`top_cosine` **chỉ đếm chunk không expired`;
      `conflict_detected` = ≥ 2 `document_id` khác nhau **vào context** cùng `category` **và**
      cùng `heading_path`.
      Files: `lib/kb/retrieve.ts`, `lib/kb/rank.ts`, `tests/unit/kb/retrieve.test.ts`,
      `tests/unit/kb/rank.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/kb` pass, gồm các ca R3-H1/M8/M9 **mới**:
      • `cfSignal === true` ⇒ `searched_domains` **luôn** chứa `'cloud_farm'` — chạy ca này cho
        **cả ba** `method` (`'user'`, `'lexical'`, `'llm'`), **không ngoại lệ**;
      • `index.stats.by_domain.cloud_farm === 0` ⇒ `'cloud_farm'` **luôn** có trong
        `searched_domains` dù `cfSignal === false`;
      • chunk `superseded_by != null`, `valid_to: null`, cosine cao ⇒ **KHÔNG** có trong
        context, **CÓ** trong `excluded_expired`;
      • `excluded_expired` là `Record<Domain, …>`, mỗi miền tối đa 3, `excluded_expired_count`
        là tổng hai miền;
      • `rejected` **không bao giờ** xuất hiện (fixture có chứa `rejected`);
      • cùng cosine 0.30: chunk `in_review` **vẫn được giữ**, chỉ bị hạ bậc;
      • thứ tự tất định: chạy lại với mảng chunk đã **đảo** cho **cùng** danh sách kết quả;
      • trần theo tài liệu trước top-K: fixture có 1 tài liệu chiếm 4/6 chỗ đầu ⇒ kết quả có
        **6** chunk từ ≥ 3 tài liệu (không phải 4);
      • nhánh `both`: 6a/6b/6c đúng số, **không** lời gọi nào so điểm giữa hai miền.

---

### Khối D — An toàn (hạng mục 20–23) — **đóng R3-H2, R3-M1..M5**

- [ ] **20. `lib/safety/dosage-pattern.ts` — BA tầng mẫu, điểm vào duy nhất `findDosages()` (R3-H2).**
      **Đây là hạng mục đóng finding HIGH R3-H2.** Ch.10 quy tắc 4 cấm **ba** thứ: liều thuốc,
      **phác đồ điều trị** và **lịch vaccine**. Bản hiện tại chỉ bắt liều dạng số + đơn vị, nên
      ba dạng biểu đạt thường gặp đi thẳng tới người dùng: *"tiêm vaccine lúc 3 tuần tuổi, nhắc
      lại sau 4 tuần"*, *"cho uống 2 lần/ngày trong một tuần"*, *"dùng kháng sinh nhóm
      aminoglycoside trong vài ngày rồi nhắc lại"* (không có chữ số nào).
      Mở rộng thành **ba tầng**, giữ `findDosages()` là **điểm vào duy nhất**:
      ```ts
      const NUM = String.raw`(?:\d+(?:[.,]\d+)?|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|vài)`;
      const STRONG = String.raw`(?:mg\s*/\s*(?:kg|con)|ml\s*/\s*(?:kg|con)|cc\s*/\s*con|(?:IU|UI)\s*/\s*kg)`;
      const WEAK = String.raw`(?:mg|ml|cc|g|IU|UI|mũi|liều|ngày|tuần|tháng|lần|viên|gói|%|ppm)`;
      const PROTOCOL = /(phác đồ|liệu trình|lịch tiêm|lịch vaccine|lịch vắc ?xin|nhắc lại|tiêm nhắc|liều nhắc)/i;
      const DRUG_CTX = /(thuốc|kháng sinh|vaccine|vắc\s?xin|vacxin|tiêm|chích|phác đồ|điều trị|liều|uống)/i;
      const REFERRAL = /(bác sĩ thú y|người có thẩm quyền|chuyên gia thú y|liên hệ)/i;
      const WINDOW = 40;   // ký tự, hai phía
      export function findDosages(text: string): Array<{ text: string; tier: 'strong' | 'weak' | 'protocol' }>;
      ```
      Quy tắc: `STRONG` **luôn** tính; `WEAK` chỉ tính khi có `DRUG_CTX` trong cửa sổ **±40 ký
      tự**; **`PROTOCOL` chỉ tính khi KHÔNG có `REFERRAL` trong cùng cửa sổ ±40 ký tự** (cửa sổ
      loại trừ). Đơn vị không được là đầu của một từ khác: dùng **`(?![\p{L}])` với cờ `u`**,
      **không** dùng `\b` (`\b` của JS chỉ hiểu `[A-Za-z0-9_]` nên coi `ũ` trong `mũi` là ranh
      giới từ và hỏng ngay với tiếng Việt).
      **Lưu ý ripple:** kiểu trả về đổi từ `string[]` sang `{text, tier}[]` ⇒ phải sửa **4 nơi
      gọi**: `hasApprovedVetBasis()`, `dosageIsGrounded()`, bộ lọc `refCitations` (R2-M9), và
      điều kiện `mustBuffer`. Tất cả vẫn dùng `.length > 0` / `.length === 0` nên sửa là cơ học,
      nhưng **không được bỏ sót nơi nào**.
      Files: `lib/safety/dosage-pattern.ts`, `tests/unit/safety/dosage-pattern.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/safety/dosage-pattern.test.ts` pass với **hai
      danh sách tường minh**:
      • **PHẢI khớp** (cũ): `15 mg/kg`, `15mg/kg`, `15 mg / kg`, `2 ml/con`, `0,5 ml thuốc`,
        `tiêm 3 ngày`, `2 mũi vaccine`, `liều 1 g`, `uống 5 ml điện giải`, `kháng sinh 1 g/con`.
      • **PHẢI khớp** (mới, R3-H2): `3 tuần tuổi, nhắc lại sau 4 tuần`, `2 lần/ngày`,
        `uống vài ngày`, `phác đồ 3 bước`, `tiêm nhắc lại`, `liệu trình kháng sinh`.
      • **PHẢI KHÔNG khớp**: `lợn 20 kg`, `chuồng 15 m²`, `cho ăn 500 g/con`, `cai sữa 21 ngày`,
        `28 ngày tuổi`, `nái mang thai 114 ngày`, `theo dõi 2 tuần sau cai sữa`, `FCR 2,5`,
        `nhiệt độ 28 độ`, `trong lúc điều trị cho ăn 500 gam cám`,
        **`liên hệ bác sĩ thú y để được chỉ định phác đồ`** (cửa sổ loại trừ `REFERRAL`).
      • Cửa sổ ngữ cảnh: `g` cách từ khoá thuốc **41** ký tự ⇒ không khớp; **39** ký tự ⇒ khớp.
      • Một **test tĩnh** quét mã nguồn tìm `mg/kg` chốt rằng **không module nào khác** khai
        regex liều riêng.

- [ ] **21. `lib/safety/messages.ts` — 5 hằng văn bản + bảng Notice đầy đủ (R3-M3, R3-M4, R3-M5, R3-N1).**
      Bốn hằng §12.2a: `MSG_INSUFFICIENT` (có `ask_pig` 3 câu và `ask_cf` 3 câu),
      `MSG_REFUSED_VET`, `MSG_NO_CF_DOCS`, `MSG_PARTIAL_NO_CF` — đúng từng chữ như §12.2a.
      **R3-M3 — hằng thứ NĂM `MSG_DIAGNOSIS_SAFETY`** (nửa (b) bắt buộc của Ch.10 quy tắc 3)
      với `title` + `steps: readonly string[]` + `action`. Nội dung **chỉ gồm biện pháp
      không-thuốc** (tách ô nuôi, hạn chế người/xe qua lại, giữ nước uống, ghi nhận số con có
      dấu hiệu) và câu liên hệ bác sĩ thú y, và **KHÔNG chứa bất kỳ con số kèm đơn vị nào** —
      nếu chứa, chính văn bản an toàn do code chèn sẽ làm guard huỷ toàn bộ câu trả lời và
      người dùng mất luôn nửa (b).
      **R3-M4 — chuyển cả 5 mã `Notice` vào MỘT bảng duy nhất** trong file này, mỗi mã có
      `level`, `message` (hàm nhận tham số khi cần, ví dụ `EXPIRED_DOCS({ n })`) và **ĐIỀU KIỆN
      PHÁT ghi ngay cạnh**. `COMMERCIAL_SOURCE` **bị bỏ khỏi enum** (phương án (a) đã chốt ở
      §0.1) — nguồn thương mại chỉ được **gắn nhãn** trong khối trích dẫn, đúng chữ Ch.14.
      **R3-M5 — chốt hai ngưỡng khác nhau cho hai việc khác nhau:**
      • **"BẤT KỲ"** cho cảnh báo người dùng: `>= 1` trích dẫn `in_review` ⇒ `Notice`
        `IN_REVIEW_SOURCES` cấp `warning` với message
        *"{k}/{n} tài liệu được dẫn CHƯA được chuyên gia duyệt (in_review)."*
      • **"MỌI"** cho hard rule trong prompt: **mọi** chunk context là `in_review` ⇒ thêm hard
        rule §12.1.
        Lý do: Ch.3 (*"Tài liệu chưa xác minh không được xem ngang hàng với tài liệu chính
        thức"*) đứng về phía "bất kỳ". Ở bản demo hai cách hiểu trùng nhau nên lỗi này sẽ
        **không** bị phát hiện trong kiểm thử rồi lộ ra đúng lúc chuyên gia duyệt xong vài tài liệu.
      **R3-N1**: thêm một câu — *"`answer_language` chỉ ảnh hưởng ngôn ngữ phần do LLM sinh.
      Các thông báo tất định luôn là tiếng Việt vì người đọc chúng là nhân viên và quản lý
      trại; không tạo biến thể en."*
      Files: `lib/safety/messages.ts`, `tests/unit/safety/messages.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/safety/messages.test.ts` pass, gồm: `toBe` **từng
      chuỗi** của **cả 5** hằng (không `toContain`); `ask_pig` 3 mục, `ask_cf` 3 mục, 2 miền ⇒
      6 mục với `ask_pig` **trước**; **`findDosages(renderDiagnosisSafety()).length === 0`**
      (R3-M3); context **1 approved + 1 in_review** ⇒ **CÓ** `Notice` `IN_REVIEW_SOURCES`,
      **KHÔNG** có hard rule (R3-M5); `answer_language='en'` + `refused_vet_safety` ⇒ **vẫn**
      đúng `MSG_REFUSED_VET` tiếng Việt (R3-N1); bảng Notice có **đúng 5** mã, không có
      `COMMERCIAL_SOURCE`.

- [ ] **22. `lib/safety/{rules,vet-guard,output-scan,prompt}.ts` — guard hai lớp + 7 quy tắc nguyên văn.**
      `rules.ts`: `CH10_SAFETY_RULES` đúng **từng chữ** 7 quy tắc Ch.10.
      `vet-guard.ts`: nhận diện ý định rủi ro (`dosage_intent`, `diagnosis_intent`) +
      ```ts
      export function approvedVetBasis(context: ContextChunks): RankedChunk[]  // approved && exclusion_flags rỗng && category==='PIG-07'
      export function hasApprovedVetBasis(context: ContextChunks): boolean     // approvedVetBasis(...).some(c => findDosages(c.text).length > 0)
      ```
      **R3-M1**: cả ba cổng an toàn nhận **`ContextChunks`** = `toContextChunks(retrieval)` —
      hợp hai miền **SAU** khi đã cắt ngân sách. Không phải "trước khi cắt" (một chunk approved
      bị bỏ vì hết ngân sách vẫn hợp pháp hoá một con số liều mà LLM **không hề nhìn thấy**),
      không phải "chỉ miền thắng" (bỏ sót chunk `PIG-07` của miền kia).
      **R3-N5 (đã chốt)**: giữ `category === 'PIG-07'` và ghi ngay trong docstring rằng đây là
      **giới hạn có ý thức** của bản này: *"căn cứ thú y chỉ tính nhóm Thú y đã duyệt; văn bản
      pháp luật được dẫn như nguồn nhưng không mở cổng liều"*.
      `output-scan.ts`:
      ```ts
      export function dosageIsGrounded(output: string, basis: RankedChunk[]): boolean;
      ```
      Với mục `tier` là `'strong'`/`'weak'`: giữ **phép so chuỗi con** sau `normalizeDosageText`
      (lowercase, bỏ dấu, gộp khoảng trắng, bỏ khoảng trắng quanh `/`, `,` → `.`).
      **R3-H2 phần (2)**: với mục **`tier === 'protocol'`** thì so chuỗi con **vô nghĩa**, nên
      quy tắc là: mục `protocol` **chỉ có căn cứ khi `approvedVetBasis(context)` KHÁC RỖNG**.
      Kho không có căn cứ thú y đã duyệt ⇒ `false` ⇒ `guard_abort`. Ở bản demo nghĩa là **mọi
      phác đồ do LLM tự sinh đều bị huỷ** — đúng hướng sai số đã chọn.
      Quét khẳng định chẩn đoán (`DISEASE`/`ASSERT`/`HEDGE`) **chạy KHÔNG điều kiện** cho mọi
      đầu ra; hệ quả là **thêm `Notice` `NOT_A_DIAGNOSIS` + `risk_flags += 'diagnosis_assertion'`**,
      **không huỷ** câu trả lời.
      `prompt.ts`: ghép theo thứ tự §12.1; nhóm context theo **`doc_kind`** với 3 tiêu đề tiếng
      Việt + câu ưu tiên *pháp luật > SOP nội bộ > hướng dẫn chung*; 4 hard rule chèn theo tình
      huống (gồm `CF_SCOPE_LOCK`).
      Files: `lib/safety/{rules,vet-guard,output-scan,prompt}.ts`,
      `tests/unit/safety/{rules,vet-guard,output-scan,prompt}.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/safety` pass, gồm:
      • **R3-M15/§12.1**: trích xuất 7 quy tắc đúng quy trình (bỏ BOM, cắt giữa hai marker với
        assert cả hai `> -1`, `toHaveLength(7)`, **`toEqual` so cả thứ tự**), cộng **một ca âm**
        chứng minh test không tautology (mảng thiếu 1 phần tử ⇒ test phải đỏ);
      • `hasApprovedVetBasis()`: `approved`+`PIG-07`+có mẫu liều ⇒ `true`; `approved` nhưng
        `PIG-09` ⇒ `false`; `approved`+`PIG-07` nhưng không mẫu liều ⇒ `false`;
        `approved`+`PIG-07`+có mẫu liều nhưng `exclusion_flags` không rỗng ⇒ `false`;
      • `approvedVetBasis()` **loại** chunk `approved` `PIG-05` chứa `"3 ngày"`, và
        `dosageIsGrounded('tiêm 3 ngày', [chunk PIG-05 approved])` ⇒ **`false`**;
      • **R3-M1**: một chunk approved `PIG-07` có liều **bị loại ở bước cắt ngân sách** ⇒
        `dosageIsGrounded()` **vẫn trả `false`** cho con số trong chunk đó;
      • **R3-H2**: `dosageIsGrounded('tiêm nhắc lại sau 4 tuần', [])` ⇒ `false`; cùng chuỗi với
        `approvedVetBasis` **khác rỗng** ⇒ `true`;
      • `"đàn của bạn bị dịch tả lợn châu Phi"` ⇒ `diagnosis_assertion`;
        `"có thể là dịch tả lợn châu Phi"` ⇒ **không** gắn cờ;
      • cả hai phép quét chạy khi `risk_flags` **rỗng**.

- [ ] **23. `lib/chat/pipeline.ts` + `lib/chat/stream.ts` — thứ tự §12.0, guard CF §12.4, và thứ tự quét-trước-phát-sau (R3-M2, R3-M3).**
      `pipeline.ts`: 7 bước có comment đánh số §12.0, và **thứ tự ưu tiên chốt một lần, không
      ghi đè**: `refused_vet_safety > no_cf_docs > insufficient > partial_no_cf_docs > ok`.
      `risk_flags` và `notices` **tích luỹ ĐỘC LẬP** với `grounding`.
      `mustBuffer` = `dosage_intent` ∨ `diagnosis_intent` ∨ context có `PIG-07`/`PIG-08` ∨
      context có bất kỳ mẫu liều nào; `meta.delayed = mustBuffer`.
      Guard CF §12.4 đọc **`retrieval.searched_domains`** (do `retrieve()` tính, hạng mục 19) —
      **không** đọc `router.domains`; ba nhánh `no_cf_docs` / `partial_no_cf_docs` / không làm
      gì theo `cfSignal`.
      **R3-M3 phần (2) — chốt điểm chèn khối an toàn chẩn đoán:** `MSG_DIAGNOSIS_SAFETY` được
      nối vào câu trả lời **SAU KHI `output-scan.ts` chạy xong** và **KHÔNG đi qua
      `dosageIsGrounded()`**. Nếu chèn trước khi quét, một câu rất tự nhiên như *"cô lập ô nuôi
      14 ngày và liên hệ bác sĩ thú y trước khi điều trị"* sẽ khớp `WEAK` với `DRUG_CTX` và làm
      guard huỷ toàn bộ câu trả lời.
      `stream.ts`: `HOLDBACK_CHARS = 200`. **R3-M2 — viết vòng lặp tường minh, thứ tự BẮT BUỘC
      là nhận ⇒ quét TOÀN BỘ phần chưa phát ⇒ mới phát:**
      ```ts
      buffer += chunk;
      const unsent = buffer.slice(sentLen);
      if (!dosageIsGrounded(unsent, basis)) return abortGuard();
      const emitTo = Math.max(sentLen, buffer.length - HOLDBACK_CHARS);
      emit(buffer.slice(sentLen, emitTo));
      sentLen = emitTo;
      ```
      Chốt thêm: phép kiểm ở **CẢ HAI** chế độ là **`dosageIsGrounded`** (`findDosages` chỉ là
      thành phần bên trong nó — không phải hai phép kiểm khác nhau như bảng §12.3 đang viết),
      và `basis = approvedVetBasis(contextChunks)` tính **MỘT LẦN trước khi mở stream**.
      `mustBuffer=true` ⇒ buffer toàn bộ, kiểm một lần trên toàn văn, rồi mới phát.
      Files: `lib/chat/{pipeline,stream}.ts`, `tests/unit/chat/{pipeline,stream}.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/chat` pass, gồm:
      • thứ tự ưu tiên với input có **ba** điều kiện cùng đúng ⇒
        `grounding === 'refused_vet_safety'`, **và** `notices` chứa `NO_CF_DOCS`, **và**
        `risk_flags` chứa `cf_no_docs`;
      • `mustBuffer` bật khi context có chunk `PIG-07`/`PIG-08` **dù** `risk_flags` rỗng;
      • `trimByTokenBudget` bỏ phần tử **cũ nhất** trước; `assertBudget` cắt **context** (không
        cắt quy tắc an toàn, không cắt câu hỏi) và log `warn` **một lần**;
      • **R3-M6**: với cấu hình **mặc định** (`TOTAL=6500`) và history 10 × 4000 ký tự + context
        đầy ⇒ **`assertBudget` KHÔNG cắt gì**;
      • **R3-M2**: chuỗi liều bị **cắt ngang hai mảnh** (`"…tiêm 15 m"` + `"g/kg trong 3 ngày…"`)
        vẫn bị phát hiện; với `mustBuffer=false`, **không ký tự nào** của chuỗi liều được phát
        trước khi guard nổ; **liều CÓ căn cứ ở chế độ `mustBuffer=false` ⇒ ĐƯỢC phát và
        `finish_reason === 'stop'`** (ca chứng minh phép kiểm là `dosageIsGrounded`, không phải
        `findDosages`);
      • 200 ký tự cuối chỉ được phát khi stream đóng bình thường.

---

### Khối E — Bề mặt ứng dụng: auth, API, UI (hạng mục 24–28)

- [ ] **24. `lib/auth/*` + `middleware.ts` — bốn module Edge-safe, không `node:crypto`.**
      `session.ts` (sign/verify HMAC-SHA256 — **chỉ** `globalThis.crypto.subtle`),
      `password.ts` (băm SHA-256 hai phía rồi so bằng `timingSafeEqualBytes` tự viết),
      `constant-time.ts`, `safe-next.ts`, `rate-limit.ts`.
      **Bất biến #12 — không tạo `lib/auth/index.ts` tái export**; `session.ts` và mọi thứ nó
      import phải Edge-safe (không `node:*`, không `fs`, không `Buffer`; dùng `TextEncoder`,
      `Uint8Array`, base64url tự viết).
      `middleware.ts` với `matcher: ['/', '/api/chat']`; thiếu `SESSION_SECRET` ⇒ coi mọi
      request là chưa đăng nhập, `warn` **một lần**, **KHÔNG throw** (throw làm toàn site trả
      500, trái yêu cầu cứng "app phải khởi động được khi thiếu key"); không có vòng lặp
      redirect vì `/login` nằm ngoài matcher.
      `rate-limit.ts`: sliding window in-memory; login theo IP 5/15m; **backstop toàn cục
      30 lần SAI/15m độc lập IP** (đăng nhập **đúng** không tiêu quota); chat 20/5m; hai chế độ
      lấy IP theo `TRUSTED_PROXY`; độ trễ tăng dần `sleep(min(n × 250ms, 2s))` khi sai.
      **R3-N4**: thêm rate limit **60/5m** cho **`/api/health` và `/api/logout`** bằng cùng
      module, và `Cache-Control: no-store` cho cả hai.
      Files: `lib/auth/{session,password,constant-time,safe-next,rate-limit}.ts`, `middleware.ts`,
      `tests/unit/auth/*.test.ts`.
      Verify: `npm.cmd run test -- tests/unit/auth` pass, gồm: sign→verify OK, sửa 1 byte
      payload ⇒ fail, hết hạn ⇒ fail; **chạy trong môi trường chỉ có Web Crypto** (xoá
      `node:crypto` khỏi module registry) ⇒ phải pass; **test tĩnh** quét đồ thị import của
      `session.ts` không chứa `node:`; `safeNext` đủ bộ ca âm (`//evil.com`,
      `https://evil.com`, `\\evil.com`, `javascript:alert(1)`, `/%2F%2Fevil.com`,
      `/\evil.com`, chuỗi `%` lỗi) ⇒ tất cả về `'/'`; rate limit: cho qua tới hạn, chặn khi
      vượt, cửa sổ trôi reset đúng (fake timers), parse `'5/15m'`/`'20/5m'`/`'30/15m'`,
      `'abc'`/`'5/15x'` ⇒ mặc định + `warn` một lần **không throw**, backstop 30 lần **sai**
      chặn mọi IP, đăng nhập **đúng** không tiêu quota, **`TRUSTED_PROXY=false` ⇒ header bị bỏ
      qua hoàn toàn, khoá là `'untrusted'`** (nhánh bảo mật này phải có test dù nền tảng chạy
      nó chưa nghiệm thu).

- [ ] **25. `app/api/*/route.ts` — 4 route, hợp đồng §14, và tách mã lỗi body (R3-M13).**
      Mọi route `export const runtime = 'nodejs'`. `/api/chat` thêm
      `export const maxDuration = 60` **và** `const DEADLINE_MS = 50_000` với assertion lúc
      khởi tạo module `DEADLINE_MS + 5_000 <= maxDuration * 1000`.
      Trần body kiểm ở **dòng đầu** cả hai handler POST, **trước `req.json()`**; `req.json()`
      bọc `try/catch`.
      **R3-M13 — tách mã lỗi, vì hiện tại một client tuân thủ đúng tài liệu vẫn bị 400 với
      thông báo nói SAI nguyên nhân** (tiếng Việt 3 byte/ký tự nên hội thoại dài bình thường
      vượt 64 KB, rồi server trả *"Câu hỏi không hợp lệ (quá dài / để trống)"* trong khi câu
      hỏi hoàn toàn hợp lệ):
      • giữ `INVALID_BODY` (400) cho **câu hỏi sai / JSON lỗi**;
      • thêm **`BODY_TOO_LARGE` (413)** với message
        *"Hội thoại quá dài. Hãy bấm Xoá hội thoại rồi hỏi lại câu hỏi hiện tại."* và một dòng
        tương ứng ở bảng §16.4;
      • sửa hợp đồng `history`: client **CẮT history theo `HISTORY_TOKEN_BUDGET`** bằng **cùng
        hàm `trimByTokenBudget`** (ở `lib/util/tokens.ts`, dùng chung hai phía) **TRƯỚC khi
        gửi**; giới hạn "10 phần tử / 4000 ký tự mỗi phần tử" được ghi lại đúng bản chất là
        **trần an toàn của server**, không phải mức được phép dùng hết.
      Server vẫn **lọc và cắt `history` thay vì tin**, và **không** trả lỗi cho `history` sai.
      `/api/chat` **tự kiểm lại session** ở đầu handler (hai lớp, vì `matcher` là cấu hình
      chuỗi).
      Event NDJSON: `meta` (**luôn** dòng đầu) → `token`* → `notice` → `citations` → `done`;
      lỗi giữa stream ⇒ `{"type":"error"}` + `{"type":"done","finish_reason":"error"}`.
      **R3-N2**: ba trạng thái không gọi LLM dùng `finish_reason: 'refused'` và
      `usage.chunks_used = 0`; `guard_abort` giữ riêng cho trường hợp đã sinh rồi bị huỷ.
      Bảng 5 mã lỗi nhà cung cấp AI phân biệt được **chờ** vs **gọi IT** (§14.2) phải đủ cả 5.
      `/api/health` trả đúng hình dạng §14.3 gồm `embedding.source: "index-metadata"` và
      `security.trusted_proxy`; **R3-N4**: ghi một câu rằng để health công khai là **quyết định
      có ý thức** (nghiệm thu sau deploy khi chưa có mật khẩu) và nó chỉ trả số đếm, không trả
      nội dung tài liệu.
      Files: `app/api/{chat,login,logout,health}/route.ts`.
      Verify: `npm.cmd run test -- tests/integration/api` pass (bộ ca đầy đủ ở hạng mục 29);
      `npm.cmd run build` pass (chứng minh không có import Node nào lọt vào bundle Edge).

- [ ] **26. `app/page.tsx` + `app/login/page.tsx` + `components/chat/*` — UI tiếng Việt, responsive mobile.**
      `ChatShell.tsx` giữ toàn bộ state (dùng lại **đúng** `ChatMeta`/`CitationMeta`/`Notice`
      của `lib/kb/types.ts`, không khai kiểu riêng cho UI). Đủ các component §4:
      `MessageList`, `MessageBubble`, `MarkdownView` (react-markdown + remark-gfm + `prose
      prose-sm`, **không `rehype-raw`**), `CitationBlock`, `StatusBadge`, `GroundingNotice`,
      `InReviewWarning`, `DomainSelector`, `LanguageSelector`, `Composer`, `ConfigBanner`,
      `ErrorNotice`, và `components/ui/{Button,Spinner,CopyButton,ConfirmDialog}.tsx`.
      Các yêu cầu sản phẩm phải thấy được trên UI:
      • **streaming có hạ cấp an toàn**: `meta.streaming === false` ⇒ *"Đang trả lời…"* +
        spinner thay con trỏ gõ chữ; `meta.delayed === true` ⇒ *"Đang kiểm tra an toàn…"*;
      • **bộ chọn miền** (Tự động / Chăn nuôi lợn / Cloud Farm) và **bộ chọn ngôn ngữ trả lời**
        (Tiếng Việt / English);
      • **render markdown**;
      • **khối trích dẫn** có `document_id` + **phiên bản** + **badge trạng thái duyệt**
        (`approved` xanh / `in_review` vàng, **màu KÈM chữ** để người mù màu phân biệt được),
        cộng `heading_path`, ngày rà soát, link `source_url` (`rel="noopener noreferrer"`),
        nhãn **"Nguồn thương mại"** khi `source_bias === 'commercial'` (R3-M4: nhãn, không phải
        Notice), và **R3-M11** *"Bản dịch của {document_id}"* khi `translation_of != null`;
      • **trạng thái "thiếu căn cứ" RIÊNG BIỆT**: `GroundingNotice` là khối riêng, viền và nền
        khác hẳn bong bóng trả lời, **render nguyên** nội dung từ `lib/safety/messages.ts` —
        component **không tự viết câu nào** (R3-M4 mở rộng quy tắc này cho **mọi** `Notice`:
        component chỉ render `notice.message` đến từ server);
      • **R3-M8**: danh sách tài liệu hết hiệu lực hiện **theo miền**, mỗi miền tối đa 3 mục +
        *"và {n} tài liệu hết hiệu lực khác"*; rỗng ⇒ **không hiện gì**;
      • khối `refused_vet_safety` dùng tiêu đề riêng **"Thông tin tham khảo chung — không phải
        chỉ định điều trị"**; rỗng ⇒ **không** hiện khối;
      • **R3-M13**: `useChatStream` cắt history bằng `trimByTokenBudget` và kiểm
        `new TextEncoder().encode(body).length <= 64_000` **trước** khi `fetch`.
      Mobile §16.3: một cột `max-w-3xl mx-auto`; composer dính đáy với
      `env(safe-area-inset-bottom)`; `font-size: 16px` cho `textarea` (dưới 16px Safari iOS tự
      zoom); vùng bấm ≥ 44×44px; textarea tự giãn tới 6 dòng; Enter gửi / Shift+Enter xuống
      dòng, **trên màn hình cảm ứng Enter KHÔNG gửi** (phát hiện bằng
      `matchMedia('(pointer: coarse)')`); `aria-live="polite"` + `aria-busy`; tôn trọng
      `prefers-reduced-motion`.
      `/login`: form một ô, `autocomplete="current-password"`, `aria-live="polite"`, thành công
      ⇒ `router.push(safeNext(searchParams.get('next')))` — **không bao giờ** đưa giá trị thô
      từ URL vào `push`.
      Files: `app/page.tsx`, `app/login/page.tsx`, `components/chat/*.tsx`,
      `components/ui/*.tsx`, `hooks/useChatStream.ts`, `tests/unit/chat/useChatStream.test.ts`.
      Verify: `npm.cmd run build` pass; `npm.cmd run lint` pass;
      `npm.cmd run test -- tests/unit/chat/useChatStream.test.ts` pass, gồm: tách dòng NDJSON
      khi một mảnh TCP cắt giữa dòng; **nhận `finish_reason: 'guard_abort'` ⇒ XOÁ toàn bộ nội
      dung đã nhận (`content = ''`)** và thay bằng `GroundingNotice` `refused_vet_safety`, nút
      "Thử lại" **bị ẩn**; `CONFIG_INVALID`/`LLM_MODEL_UNAVAILABLE` ⇒ ẩn nút Thử lại;
      `BODY_TOO_LARGE` ⇒ hiện đúng message R3-M13.

- [ ] **27. `app/api/chat` ghép pipeline + cổng mật khẩu `APP_PASSWORD` chạy thật end-to-end (offline).**
      Nối toàn bộ: middleware → session → rate limit → zod body → `getIndex()` →
      `forQuery(indexMeta, env)` → embed câu hỏi → router → `retrieve()` → guard → prompt →
      LLM → `output-scan` → NDJSON. Chạy `npm.cmd run dev` với `.env.local` tạm chỉ gồm
      `APP_PASSWORD`, `SESSION_SECRET` (≥ 32 ký tự), `LLM_PROVIDER=mock`,
      `EMBEDDING_PROVIDER=mock`, và `KB_INDEX_PATH` trỏ tới **fixture** (hạng mục 15).
      **Không tạo index mock trong `data/`.**
      Files: (không file mới — hạng mục ghép và chạy thử).
      Verify: `npm.cmd run build` pass; `npm.cmd run dev` rồi kiểm bằng tay 6 việc:
      (1) `GET /` chưa đăng nhập ⇒ redirect `/login`; (2) đăng nhập sai ⇒ "Mật khẩu không
      đúng"; (3) đăng nhập đúng ⇒ vào được trang chat; (4) hỏi một câu dinh dưỡng ⇒ có token
      chạy + **khối trích dẫn có `document_id` + phiên bản + badge `in_review`**; (5) hỏi một
      câu Cloud Farm ⇒ `GroundingNotice` `no_cf_docs`; (6) `GET /api/health` ⇒
      `index.present: true` và `embedding.source: "index-metadata"`.

- [ ] **28. Ghi mốc Khối E vào `CHANGELOG-NO-GIT.md`.**
      Files: `.agents/tasks/CHANGELOG-NO-GIT.md`.
      Verify: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`,
      `npm.cmd run test` — cả bốn pass.

---

### Khối F — Eval, test tích hợp, tài liệu (hạng mục 29–33)

- [ ] **29. Bộ test tích hợp đầy đủ §19.2 — gồm 4 ca MỚI mà hai finding HIGH yêu cầu.**
      Toàn bộ bảng §19.2, chạy offline với `mock` và cặp fixture của hạng mục 15. Bốn ca mới
      **bắt buộc** (không có trong bảng §19.2 hiện tại):
      • **R3-H1 ca 1**: `domain: 'pig_farming'` **do người dùng chọn** + câu hỏi chứa
        *"trong phần mềm"* ⇒ `grounding` thuộc `{no_cf_docs, partial_no_cf_docs}`, **KHÔNG
        được là `'ok'`**. (Đây đúng là đường mà `method='user'` làm guard CF chết.)
      • **R3-H1 ca 2**: tầng 2 trả `'pig_farming'` khi `cfScore = 1` ⇒ `searched_domains`
        **vẫn chứa** `'cloud_farm'`.
      • **R3-M10 ca 1**: câu hỏi hoàn toàn ngoài phạm vi (*"giá cổ phiếu hôm nay"*) ⇒
        `grounding === 'insufficient'`, **0 lần gọi LLM**, **không có event `token`**,
        `GroundingNotice` dùng đúng `MSG_INSUFFICIENT` với `ask_pig`. (Ca này **chỉ đạt được**
        nhờ `MOCK_MIN_COSINE = 0.05` ở hạng mục 4 — với ngưỡng 0 thì mọi chunk qua cổng và
        nhánh `insufficient` không thể test offline.)
      • **R3-M10 ca 2**: `searched_domains` hai miền ⇒ danh sách `ask` có **6** mục, `ask_pig`
        **trước**.
      Giữ đủ các ca cũ, trong đó không được bỏ: `refused_vet_safety` 0 lần gọi LLM; nhánh "có
      căn cứ" của H1 được phát; `guard_abort` không token liều nào tới client ở **cả hai** chế
      độ `delayed`; ca ba-điều-kiện của R2-M2; hai ca `excluded_expired` trên `knowledge/`
      thật; `INDEX_PROVIDER_MISMATCH`; `INDEX_CORRUPT`; `content-length: 70000` ⇒ lỗi body;
      `GET /api/health` **không cần cookie**.
      Files: `tests/integration/*.test.ts`.
      Verify: `npm.cmd run test` pass **toàn bộ**, và bộ test tích hợp chạy **không cần mạng,
      không cần API key**.

- [ ] **30. `scripts/eval.ts` — `npm run eval`, chấm 7 giá trị `expected_behavior`.**
      Gọi pipeline **trực tiếp trong tiến trình** (không qua HTTP). Bảng ánh xạ §18.2 đủ 7 giá
      trị, với hằng `OUT_OF_SCOPE_COSINE = 0.15` khai trong chính file này. Chỉ đo những gì máy
      kiểm được **mà không cần đáp án chuẩn**: định tuyến miền, `must_cite_document_ids`, có
      trích dẫn khi `ok`, khớp hành vi, **rò rỉ tài liệu `rejected` phải = 0 (khác 0 là FAIL
      cứng cả lần chạy)**, rò rỉ tài liệu hết hiệu lực vào context phải = 0, độ trễ p50/p95.
      Script **in rõ giới hạn của chính nó**: *"Báo cáo này KHÔNG chấm độ đúng chuyên môn của
      câu trả lời. Theo Ch.11, điểm đó phải do chuyên gia chăn nuôi và người phụ trách Cloud
      Farm xác nhận."* Hai dòng `ask_for_more_data`/`out_of_scope` được đánh dấu **"chỉ dấu,
      không phải điểm"** khi chạy với mock. Cờ `--manual-template` xuất CSV theo đúng **7 tiêu
      chí Ch.11** để chuyên gia chấm tay.
      Files: `scripts/eval.ts`, `.agents/eval/.gitkeep`.
      Verify: `npm.cmd run eval` với `LLM_PROVIDER=mock` + `EMBEDDING_PROVIDER=mock` chạy hết
      `qa-seed.jsonl` **không lỗi**, in bảng theo 6 nhóm, ghi
      `.agents/eval/report-<timestamp>.json`, và báo `rejected_leak === 0`.

- [ ] **31. `docs/MAPPING.md` + `docs/QUALITY-RUBRIC.md` — truy vết, và SỬA bảng §20 (R3-H2 phần 4).**
      `docs/MAPPING.md` giữ bảng truy vết §20 kèm cột đường dẫn file cụ thể. **Hai sửa bắt
      buộc:**
      • **R3-H2 phần (4)**: dòng **Ch.10 quy tắc 4** phải ghi
        **"Đã làm ở mức máy — bắt theo mẫu, không phải hiểu ngữ nghĩa"**
        (cụ thể: *"bắt liều dạng số + đơn vị và các cụm phác đồ/lịch theo mẫu; không phải hiểu
        ngữ nghĩa"*), **không** ghi "Đã làm". Lý do: quy tắc 3 đã được ghi trung thực là "Đã
        làm ở mức máy", nên chênh lệch đó làm người đọc bảng truy vết tin rằng quy tắc 4 đã kín.
      • **R3-M9**: nếu chọn phương án (a) (đã chốt) thì `superseded_by` **thực sự** là một biện
        pháp kiểm soát rủi ro Ch.14 và được giữ ở ô biện pháp; ghi rõ nó được hiện thực ở
        `retrieve.ts` bước 1.
      Và các dòng bắt buộc khác: dòng nguyên văn về `qa-seed.jsonl` (*"= 4–6 câu/nhóm, là khung
      chờ chuyên gia mở rộng lên 30–50 câu/nhóm theo Ch.11; `expected_answer` để trống theo yêu
      cầu Ch.11."*); trạng thái **"chưa kiểm thử"** cho nhánh tự host; **"chưa làm"** cho E2E
      Playwright; dòng chế độ repo (**quyết định đã chốt**: public ở giai đoạn demo, **điều kiện
      bắt buộc chuyển private = trước tài liệu thật đầu tiên**); và **một mục mới ghi 4 quyết
      định phân định của §0.1 kèm lý do** (R3-M4 (a), R3-M6 (a), R3-M9 (a), R3-N5 (a)).
      `docs/QUALITY-RUBRIC.md`: thang điểm Ch.9 — 6 tiêu chí trọng số **20/25/15/15/15/10**,
      ngưỡng **85–100 → có thể Approved**, **70–84 → In Review**, **< 70 → Rejected**, cùng
      **5 điều kiện loại trừ dù điểm cao**.
      Files: `docs/MAPPING.md`, `docs/QUALITY-RUBRIC.md`.
      Verify: `npm.cmd run test -- tests/unit/docs/mapping.test.ts` pass — test đọc
      `docs/MAPPING.md` và chốt: có dòng Ch.10 q.4 chứa chuỗi **"Đã làm ở mức máy"**; có dòng
      nguyên văn về `qa-seed.jsonl`; có mục ghi 4 quyết định phân định.

- [ ] **32. `README.md` tiếng Việt + `Dockerfile` + `.dockerignore`.**
      README tiếng Việt cho người dùng là nhân viên/quản lý trại, phải có:
      • **BƯỚC 0 đứng trước mọi bước khác** (§17.1): chủ sở hữu chạy ở máy local
        `npm.cmd install` → tạo `.env.local` với `GEMINI_API_KEY` thật → `npm.cmd run ingest` →
        commit `knowledge/**` + `data/kb-index.json` + `data/kb-vectors.bin` +
        `data/glossary.json`. **Thiếu bước này thì bản deploy trả lỗi cho mọi câu hỏi.**
      • Quy trình GitHub → Vercel 6 bước, gồm danh sách env phải khai trên Vercel
        (`APP_PASSWORD`, `SESSION_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
        `EMBEDDING_PROVIDER=gemini`, `TRUSTED_PROXY=true`) và **câu cảnh báo KHÔNG khai
        `EMBEDDING_MODEL`/`EMBEDDING_DIMENSION`** (đường query đọc từ index).
      • **Bước nghiệm thu sau deploy bằng `GET /api/health`** với 3 điều kiện phải thấy.
      • Mục **"Lấy API key"**, và lưu ý PowerShell: phải dùng **`npm.cmd`** vì `npm.ps1` bị
        ExecutionPolicy chặn.
      • Vòng cập nhật kiến thức (sửa `knowledge/` → `ingest` ở local → commit cả `data/` → push).
      • Mục tự host đặt dưới tiêu đề **"Tuỳ chọn — chưa nghiệm thu"**; **không** viết câu nào
        ngụ ý đã chạy thử. Hướng dẫn chọn đúng `TRUSTED_PROXY` cho từng nền tảng.
      • Mục bảo mật: `.env.local` trong `.gitignore`, **không có key trong repo**, repo đang
        public nên `knowledge/` và `data/` là công khai.
      `Dockerfile` multi-stage (`node:22-alpine` build → runtime), chạy bằng user không phải
      root, `EXPOSE 3000`, copy cả `data/` và `knowledge/`. **Không tự chạy deploy.**
      Files: `README.md`, `Dockerfile`, `.dockerignore`.
      Verify: `npm.cmd run build` pass; đọc lại README và đối chiếu: BƯỚC 0 nằm **trước** bước
      push, có đủ 6 biến env, có 3 điều kiện `/api/health`, có mục `npm.cmd`, mục tự host có
      đúng tiêu đề "Tuỳ chọn — chưa nghiệm thu".

- [ ] **33. Chốt chặn cuối: 4 lệnh xác minh toàn cục + ghi mốc.**
      Chạy đủ bốn lệnh, đọc kỹ output, không bỏ qua cảnh báo nào. Rồi ghi một dòng tổng vào
      `CHANGELOG-NO-GIT.md` liệt kê **21/21 finding đã đóng**.
      Files: `.agents/tasks/CHANGELOG-NO-GIT.md`.
      Verify: `npm.cmd run typecheck` ⇒ 0 lỗi; `npm.cmd run lint` ⇒ 0 lỗi;
      `npm.cmd run test` ⇒ **toàn bộ pass**; `npm.cmd run build` ⇒ thành công;
      `npm.cmd run ingest -- --dry-run` ⇒ 0 lỗi, `files === 15`;
      `npm.cmd run eval` ⇒ chạy hết, `rejected_leak === 0`.
      Và kiểm bốn điều kiện repo: `.gitignore` **không** còn `data/kb-index.json`;
      `.gitattributes` tồn tại đủ 3 dòng; `knowledge/02_Cloud_Farm/` chỉ có `README.md` với
      cảnh báo ở **đầu** file; **`data/` KHÔNG chứa index sinh bằng mock**.

---

## 4. Bảng đóng finding — 21/21, mỗi finding trỏ tới hạng mục làm nó

| Finding | Mức | Đóng ở hạng mục | Cách đóng (rút gọn) |
|---|---|---|---|
| **R3-H1** | HIGH | **18, 19, 29** | Thêm bất biến: `cfSignal===true` ⇒ `'cloud_farm' ∈ searched_domains` **không ngoại lệ, không phụ thuộc `method`**; và `by_domain.cloud_farm===0` ⇒ `'cloud_farm'` **luôn** có trong `searched_domains`. **`retrieve()` tự tính** field đó (chữ ký mới nhận `router: RouterResult`); **bỏ** trách nhiệm khỏi router (xoá dòng "VẪN thêm cloud_farm…" khỏi cây §10). Ngân sách §11.3 nhận đầu vào là `searched_domains`. Hai ca test §19.2 mới ở hạng mục 29. |
| **R3-H2** | HIGH | **20, 22, 31** | `findDosages()` thành **ba tầng** `strong`/`weak`/`protocol`, trả `{text, tier}[]`: `NUM` thêm **số viết bằng chữ** (`một..mười`, `vài`); `WEAK` thêm **`tuần\|tháng\|lần\|viên\|gói\|%\|ppm`**; tầng **`PROTOCOL`** với **cửa sổ loại trừ `REFERRAL`** ±40 ký tự. `tier==='protocol'` **chỉ có căn cứ khi `approvedVetBasis(context)` KHÁC RỖNG**. Bộ ca test mới đủ 6 phải-khớp + 5 phải-không-khớp. **Sửa bảng §20**: Ch.10 q.4 ⇒ *"Đã làm ở mức máy — bắt theo mẫu, không phải hiểu ngữ nghĩa"*. |
| R3-M1 | MED | 3, 22 | Khai `ContextChunks` + `toContextChunks()` ở `lib/kb/types.ts` với docstring chốt nghĩa = **hợp hai miền SAU khi cắt ngân sách**; ba cổng an toàn dùng đúng tên đó; bổ sung một câu vào bất biến #7 (hợp hai miền **được phép**, cấm duy nhất là **SẮP XẾP** hoặc **CẮT** trên danh sách hợp). Ca test: chunk approved `PIG-07` bị loại ở bước cắt ngân sách ⇒ `dosageIsGrounded()` vẫn `false`. |
| **R3-M2** | MED | 23 | Vòng lặp tường minh làm đặc tả; thứ tự **BẮT BUỘC** là **nhận ⇒ quét TOÀN BỘ phần chưa phát ⇒ mới phát**. Phép kiểm ở **cả hai** chế độ là **`dosageIsGrounded`** (không phải `findDosages`); `basis` tính **một lần** trước khi mở stream. Ca test: liều **có** căn cứ ở `mustBuffer=false` ⇒ được phát, `finish_reason==='stop'`. |
| **R3-M3** | MED | 21, 23 | Hằng thứ năm **`MSG_DIAGNOSIS_SAFETY`** (`title` + `steps[]` + `action`), **chỉ** biện pháp không-thuốc, **không chứa con số kèm đơn vị**. Chèn **SAU khi `output-scan.ts` chạy xong** và **KHÔNG qua `dosageIsGrounded()`**. Unit test: **`findDosages(renderDiagnosisSafety()).length === 0`** + `toBe` từng chuỗi. |
| **R3-M4** | MED | 21, 26 | Cả **5** mã `Notice` vào **một bảng duy nhất** trong `messages.ts`, mỗi mã có `level`, `message` (hàm khi cần: `EXPIRED_DOCS({n})`) và **điều kiện phát ghi ngay cạnh**. `COMMERCIAL_SOURCE` **bỏ khỏi enum** — giữ cơ chế **nhãn** ở `CitationBlock` (phương án (a)). Thêm quy tắc: component **không tự viết chuỗi Notice nào**, chỉ render `notice.message` từ server. |
| **R3-M5** | MED | 21 | **"Bất kỳ"** cho cảnh báo người dùng (`>= 1` trích dẫn `in_review` ⇒ Notice `IN_REVIEW_SOURCES` warning, message *"{k}/{n} tài liệu được dẫn CHƯA được chuyên gia duyệt (in_review)."*); **"mọi"** cho hard rule prompt. Ca test: 1 approved + 1 in_review ⇒ **CÓ** Notice, **KHÔNG** hard rule. |
| **R3-M6** | MED | 4, 23 | Phương án **(a)**: `PROMPT_TOKEN_BUDGET_TOTAL = 6500`, khoảng hợp lệ **2500–30000** (trần phần cố định 1800 + 3500 context + 1000 history = 6300, còn 200 dự phòng). **Kiểm chéo LÚC ĐỌC ENV** trong `getRetrievalConfig()`, không thoả ⇒ mặc định + `warn` một lần. Ca test: cấu hình mặc định + history 10×4000 ký tự + context đầy ⇒ **`assertBudget` không cắt gì**. |
| **R3-M7** | MED | 6, 14 | Ba dòng sơ đồ §5.1 bị sửa theo §9.1 (quy tắc phân định 2): **PII là LỖI CỨNG mặc định**; **retry cho 429 VÀ 503**; **bỏ hẳn bước L2-normalize khỏi luồng ingest** — normalize ở **tầng ADAPTER** (bất biến #2), vì chỉ như vậy **đường query** mới được bảo vệ. Ghi vào §5.1 một dòng dẫn chiếu: chuỗi bước chuẩn và duy nhất ở §9.1. |
| R3-M8 | MED | 3, 19, 26 | `excluded_expired` đổi thành **`Record<Domain, CitationMeta[]>`** — trần **3 theo miền**, sắp cosine giảm dần **trong miền**, **không trộn**; `excluded_expired_count` = tổng (trần 6); `per_domain` thêm `excluded_expired`; UI hiện theo miền + *"và {n} tài liệu hết hiệu lực khác"*; bổ sung câu vào bất biến #7. |
| R3-M9 | MED | 19, 15, 31 | Phương án **(a)**: `expired = (valid_to != null && valid_to < now) \|\| superseded_by != null`. Tài liệu đã bị thay thế **không bao giờ** vào context nhưng **vẫn được báo** trong `excluded_expired` kèm `superseded_by`. Ca test: chunk `superseded_by != null`, `valid_to: null`, cosine cao ⇒ **không** trong context, **có** trong `excluded_expired`. |
| R3-M10 | MED | 4, 29 | Ghi đè khi mock đổi từ `0` thành hằng **`MOCK_MIN_COSINE = 0.05`** (một epsilon dương giữ cho nhánh "không liên quan" **tồn tại được** offline). Hai ca `§19.2` mới: *"giá cổ phiếu hôm nay"* ⇒ `insufficient`, **0 lần gọi LLM**, không event `token`, đúng `MSG_INSUFFICIENT` + `ask_pig`; hai miền ⇒ **6** mục `ask`, `ask_pig` trước. |
| R3-M11 | MED | 9, 3, 26 | Bổ sung **đủ 7 dòng** vào bảng validate §8.1 (`license_status` **bắt buộc**, `valid_from`, `superseded_by` phải **trỏ tới id tồn tại**, `translated_language` phải **khác** `language`, `translation_of` phải tồn tại, `source_bias`, `quality_breakdown` tổng có trọng số khớp `quality_score` ±1, `tags`). Thêm `translated_language`/`translation_of`/`superseded_by` vào `IndexedChunk` + `CitationMeta`; UI hiện *"Bản dịch của {document_id}"*. §9.3 liệt kê **tường minh** field cố ý **không** mang vào index (`quality_score`, `quality_breakdown`, `tags`) kèm lý do. |
| R3-M12 | MED | 3, 5, 6, 7, 14 | `LlmChatRequest` có **`ctx: Ctx`** (thay `signal?: AbortSignal`); `embedBatch(texts, kind, ctx)`. `Ctx` giữ **cả** `signal` (nút Dừng) và `deadline` (số, để `canRetry` biết "còn 1,2s nên đừng ngủ 8s"). `scripts/ingest.ts` truyền `ctx = { requestId: 'ingest', deadline: Number.POSITIVE_INFINITY }`. **Không** dùng biến module-scope (sai trên serverless) hay AsyncLocalStorage. |
| R3-M13 | MED | 25, 5, 26 | `history` cắt theo **`HISTORY_TOKEN_BUDGET`** bằng **cùng hàm `trimByTokenBudget`** ở `lib/util/tokens.ts` dùng chung hai phía, **trước khi gửi**; client kiểm `TextEncoder().encode(body).length <= 64_000`. Tách mã lỗi: `INVALID_BODY` cho câu hỏi sai/JSON lỗi, thêm **`BODY_TOO_LARGE` (413)** *"Hội thoại quá dài. Hãy bấm Xoá hội thoại rồi hỏi lại câu hỏi hiện tại."* + dòng tương ứng ở §16.4. Giới hạn 10 phần tử/4000 ký tự được ghi lại đúng bản chất là **trần an toàn của server**. |
| R3-N1 | NIT | 21 | Một câu vào §12.2a: `answer_language` chỉ ảnh hưởng phần **do LLM sinh**; các thông báo tất định **luôn tiếng Việt**, không tạo biến thể `en`. Ca test: `answer_language='en'` + `refused_vet_safety` ⇒ vẫn đúng `MSG_REFUSED_VET`. |
| R3-N2 | NIT | 3, 25 | Thêm giá trị **`'refused'`** vào enum `finish_reason`, dùng cho **cả ba** trạng thái tất định; `usage.chunks_used = 0` khi `finish_reason === 'refused'`. Giữ `guard_abort` **riêng** cho trường hợp đã sinh rồi bị huỷ (eval và UI phân biệt hai việc đó). |
| R3-N3 | NIT | 3, 17, 4 | Thêm **`vectors_file: string`** vào `LoadedIndex.embedding`; chốt đường dẫn `.bin` = `path.join(path.dirname(KB_INDEX_PATH), embedding.vectors_file)`; thêm cảnh báo ở §6.1: đổi `KB_INDEX_PATH` ra ngoài `./data/` ⇒ `outputFileTracingIncludes` không đóng gói đúng file ⇒ `INDEX_MISSING` trên Vercel. |
| R3-N4 | NIT | 24, 25 | Áp rate limit **60/5m** cho `/api/health` và `/api/logout` bằng cùng `lib/auth/rate-limit.ts`; thêm `Cache-Control: no-store` cho cả hai; ghi một câu ở §14.3 rằng để health công khai là **quyết định có ý thức** và nó chỉ trả số đếm. |
| R3-N5 | NIT | 22, 31 | Phương án **(a)** (quy tắc phân định 3 — chặn nhiều hơn): giữ `category === 'PIG-07'`, và ghi ngay trong docstring + `docs/MAPPING.md`: *"căn cứ thú y chỉ tính nhóm Thú y đã duyệt; văn bản pháp luật được dẫn như nguồn nhưng không mở cổng liều"*. |
| R3-N6 | NIT | 14, 9 | Chốt ba định nghĩa: `stats.skipped` = **số file `.md` bị loại vì `rejected`** (không tính file loại trừ ở bước 1); `glossary.json` = `{ version: 1, terms: Array<{vi,en,abbr,unit,note,group}> }` **đã chuẩn hoá sẵn khoá khớp**; `ingest-report.json` = `{ingested_at, duration_ms, stats, warnings[], pii_policy, flags[]}`. Thêm **zod schema cho `glossary.json`** ở `lib/kb/schema.ts` vì nó được đọc lúc chạy. |

---

## 5. Bảng kiểm sản phẩm phải có

| Sản phẩm bắt buộc | Hạng mục | Xác minh |
|---|---|---|
| App Next.js 15 **chạy được** | 1, 27 | `npm.cmd run build` + `npm.cmd run dev` kiểm tay 6 việc |
| UI tiếng Việt, **responsive mobile** | 26 | `build` + `lint` pass; §16.3 đủ 8 điểm mobile |
| **Streaming có hạ cấp an toàn** | 7, 23, 26 | Test: SSE lỗi ⇒ vẫn đủ `meta(streaming:false)` → `token`* → `citations` → `done` |
| **Bộ chọn miền** | 26 | `DomainSelector` → field `domain`; test router `user` override |
| **Bộ chọn ngôn ngữ trả lời** | 26 | `LanguageSelector` → field `answer_language`; test R3-N1 |
| **Render markdown** | 26 | react-markdown + remark-gfm, **không `rehype-raw`** (hạng mục 2 kiểm (i)) |
| **Khối trích dẫn** (`document_id` + phiên bản + badge trạng thái duyệt) | 26 | Kiểm tay (4) ở hạng mục 27 |
| **Trạng thái "thiếu căn cứ" riêng biệt** | 21, 26 | `GroundingNotice` khối riêng, render **nguyên** `messages.ts`; ca R3-M10 |
| **Cổng mật khẩu `APP_PASSWORD`** | 24, 25, 27 | Kiểm tay (1)(2)(3) ở hạng mục 27 + test tích hợp login |
| **`npm run ingest`** | 14 | `npm.cmd run ingest -- --dry-run` ⇒ 0 lỗi, `files === 15` |
| **`npm run eval`** | 30 | `npm.cmd run eval` chạy hết với mock, `rejected_leak === 0` |
| `knowledge/` theo **Phụ lục A** | 11 | Cây đủ; `02_Cloud_Farm/` **rỗng nội dung**, chỉ `README.md` |
| **Glossary song ngữ ≥ 25 mục** | 12 | Đếm dòng bảng ≥ 27 |
| **8–12 tài liệu demo tự soạn**, `in_review` / `reviewer: null` / có cảnh báo | 12 | 12 tài liệu; ingest `--dry-run` 0 lỗi; `by_verification_status.approved === 0` |
| **`knowledge/_sources/sources.yaml`** từ Phụ lục B | 13 | 12 mục, **12/12** `needs_review`, **không có nội dung nguồn nào** |
| **`qa-seed.jsonl`** 6 nhóm Ch.11, có ca khó, **đáp án chuẩn ĐỂ TRỐNG** | 13 | Test: mọi dòng `expected_answer === null`; đủ 7 `hard_case` |
| **`.env.example`** (placeholder, **KHÔNG key thật**) | 1 | Mọi dòng `=` để rỗng; test tĩnh quét repo không có chuỗi dạng key |
| **`README.md` tiếng Việt** | 32 | Có BƯỚC 0 trước bước push, 6 biến env, 3 điều kiện `/api/health` |
| **`docs/MAPPING.md`** | 31 | Test chốt dòng Ch.10 q.4 chứa "Đã làm ở mức máy" |
| **`.gitattributes`** + **`.gitignore` đã sửa** | 1 | `.gitignore` không còn `kb-index`; `.gitattributes` đủ 3 dòng |
| Cảnh báo repo public ở **đầu** `02_Cloud_Farm/README.md` | 11 | 5 dòng đầu file chứa khối cảnh báo |
| Chốt chặn repo public trong `npm run ingest` | 14 | Test: `02_Cloud_Farm/` có `.md` ⇒ **in cảnh báo, không chặn** |
| **KHÔNG crawl/copy** nội dung Merck/PIC/KSU/WOAH/FAO | 12, 13 | `sources.yaml` chỉ có metadata; 12 tài liệu là nội dung gốc tự soạn |

---

## 6. Ba điều tuyệt đối không được làm

1. **Không chạy lệnh git** ở bất kỳ bước nào. "Commit" = lưu file + ghi dòng vào
   `.agents/tasks/CHANGELOG-NO-GIT.md`.
2. **Không commit index sinh bằng `mock` vào `data/`.** Nếu chưa có key thì để `data/` **trống**
   — production với provider `gemini` sẽ trả `INDEX_PROVIDER_MISMATCH` cho mọi câu hỏi **trong
   khi repo trông như đã có index**, một lỗi khó chẩn đoán hơn là không có file. Index mock chỉ
   tồn tại ở `tests/fixtures/`.
3. **Không hard-code API key, không ghi key vào bất kỳ file nào trong repo, không in key ra log
   hay báo cáo.** Nếu cần debug thì chỉ in 6 ký tự đầu.

**Và một quy tắc dừng:** nếu gặp mâu thuẫn **ảnh hưởng hành vi an toàn** mà không chắc cách giải,
**DỪNG và hỏi orchestrator** bằng `send_message` severity `warning`. Đừng đoán.





