# Changelog (no git)

Git is not installed on this machine, so no commits are made. Each completed
milestone is recorded here instead of as a commit message. The repository will
be initialized later by the owner against this same file tree.

- chore: initialize project scaffold — created `.gitignore` (Next.js + TypeScript,
  ignoring `node_modules/`, `.next/`, `.env.local`, `.env*.local`, `.vercel/`,
  `*.log`, `data/kb-index.json`) and the work-docs directory `.agents/tasks/`.
  Node v24.19.0 verified. No git commands run.

- docs(design): wrote the technical design at `.agents/tasks/design.md` (21 sections)
  plus the verification record `.agents/tasks/verify-gemini.md`. Stack locked:
  Next.js 15 App Router + TypeScript + Tailwind 3.4; Gemini default via raw `fetch`
  (no SDK); `gemini-3.5-flash` chat, `gemini-embedding-001` at 768 dims.
  Encoded measured Gemini facts: `?key=` auth (Bearer → 401), key validation
  non-empty only, fallback model list empty by default (3.8-flash and flash-latest
  measured 503 twice), and the Matryoshka pitfall — truncated embeddings are NOT
  unit-norm (768 → L2 0.592158), so vectors are L2-normalized in the adapter on
  both the ingest and query paths before dot-product scoring.
  Two pending design-driven repo changes for the implement step: remove
  `data/kb-index.json` from `.gitignore` (index is a deliberately committed build
  artifact) and add `.gitattributes` marking `data/kb-vectors.bin` as binary so
  Windows CRLF conversion cannot corrupt the vectors. No git commands run.

- docs(design): revision 2 of `.agents/tasks/design.md` — addressed all 25 findings of
  `design-review.json` (4 HIGH, 17 MEDIUM, 4 NIT; verdict was CHANGES_REQUESTED).
  Document grew 1.565 → 2.307 lines; responses per finding are in the new §22, and every
  in-place change carries an inline `[H1]`…`[N4]` tag.
  Blocking fixes: vet dosage guard split into `hasApprovedVetBasis()` (approved + PIG-07 +
  no exclusion flags + chunk actually contains dosage text) and `dosageIsGrounded()` (every
  dosage number must trace back into an approved chunk, else `guard_abort`) [H1]; Cloud Farm
  guard now keys off `searched_domains` and adds a new `partial_no_cf_docs` grounding state so
  the `both` routing branch can no longer answer software questions from pig-farming context
  [H2]; added the `PATH_TAXONOMY` constant (23 directories), `PIG-GLOSSARY`/`PIG-LEGAL`
  categories, an archived-folder exemption with a compensating constraint, and a `doc_kind`
  field that finally gives Ch.10 rule 6 somewhere to live [H3]; sample-document dates moved to
  `2026-11-01` because the target machine clock is `2026-11-05` and future dates are a hard
  ingest error [H4].
  Note for future agents: the premise at the top of this file is wrong — git **is** installed
  (v2.56.0.windows.4, outside PATH). The practice stands for a different reason: workflow steps
  do not run git; the orchestrator owns all git operations. No git commands run.

- docs(review): design review round 2 — rewrote `.agents/tasks/design-review.md` and
  `.agents/tasks/design-review.json`. Verdict `CHANGES_REQUESTED`: 2 HIGH, 11 MEDIUM, 8 NIT
  (ids `R2-*`, so they never collide with the round-1 `[H1]`…`[N4]` tags embedded in design.md).
  Round-1 regression check: all 25 round-1 findings have real edits in the text; four were fixed
  with a residual hole inside the fix itself, which is what the round-2 HIGHs are.
  R2-H1: the dosage output scan only runs when `dosage_intent` is set, so a question matching only
  the diagnosis keyword list ("lợn con tiêu chảy xử lý thế nào") streams an LLM-invented dosage
  straight to the user — and with zero `approved` docs in the demo KB, every dosage is ungrounded
  by definition. R2-H2: router tier 1 drops a domain whose score is 0 (`max >= 2 × 0` is always
  true) and the CF keyword table is effectively empty (no `software_module`, pig-only glossary),
  so a Cloud Farm question routes to pig_farming alone and the §12.4 guard never evaluates.
  Verified by running, not assumed: machine clock `2026-11-05` (so the `2026-11-01` sample dates
  pass), the proposal file has a BOM `EF BB BF` and LF-only endings, the §12.1 extraction procedure
  yields exactly 7 lines between the chapter markers and all 7 match `CH10_SAFETY_RULES`
  character-for-character, node v24.19.0 / npm 11.17.0 / git 2.56.0.windows.4, and `.gitignore`
  still carries the `data/kb-index.json` line the design says must be removed. No git commands run.

- docs(design): revision 3 of `.agents/tasks/design.md` — addressed all 21 round-2 findings
  (2 HIGH, 11 MEDIUM, 8 NIT). Document grew 2.307 → 2.739 lines; per-finding responses are in
  the new §22.2 (§22.1 keeps the round-1 history), and every in-place change carries an inline
  `[R2-*]` tag, which outranks a round-2 `[H1]`…`[N4]` tag on the same spot.
  R2-H1: separated "buffer the stream" from "scan the output". The scan now runs for **every**
  answer; `mustBuffer` (dosage/diagnosis intent, or context holding PIG-07/PIG-08, or context
  holding any dosage pattern) only chooses between buffering the whole answer and streaming with
  a 200-character holdback that is scanned incrementally. Ungrounded dosage mid-stream aborts the
  LLM read, emits `GUARD_ABORT` + `done(guard_abort)`, and the client must erase the whole message.
  The diagnosis-assertion scan is unconditional too.
  R2-H2: added `CF_OPERATION_LEXICON` (36 generic software-operation terms, no invented Cloud Farm
  menu/field names, so Ch.2.2 and Ch.10 rule 5 stay intact) and rewrote tier-1 routing — a domain
  with a score above 0 is never dropped, and when the CF store is empty `cloud_farm` stays in
  `searched_domains` so the §12.4 guard always evaluates. `RouterResult.cfSignal` now separates
  "we searched CF" from "the user actually asked about CF" (R2-M8), which also stops a pure
  pig-farming question with a 0/0 lexical score from being refused with a Cloud Farm message.
  Other blocking fixes: grounding-state precedence written out as §12.0 (`refused_vet_safety >
  no_cf_docs > insufficient > partial_no_cf_docs > ok`, flags and notices accumulate independently);
  `approvedVetBasis(context)` defined explicitly so "basis" can no longer be read as "any approved
  doc"; a single `findDosages()` module with a strong/weak two-tier pattern and a ±40-character
  drug-context window, plus the false-positive cases the review measured (`cho ăn 500 g/con`,
  `cai sữa 21 ngày`) as required negative tests; expired documents now pass through a relevance
  gate before being reported, which is what makes the Ch.11 `outdated_doc` case meaningful;
  `lib/safety/messages.ts` holds the four deterministic Vietnamese notices verbatim; the ranking
  algorithm is now 8 numbered steps plus a fixed leftover-budget order; `/api/health` added to
  `outputFileTracingIncludes`; and §17.1 gained **Bước 0** (owner runs `npm run ingest` locally and
  commits `data/` before the first push) with an explicit ban on committing a `mock`-built index.
  Deliberate deviations from the review's literal text, all justified in §22.2: `CitationMeta.score`
  became non-nullable `number`; `cfSignal` uses the R2-M8 definition extended with `method='user'`;
  no `--no-reuse-vectors` flag; the Dockerfile stays in scope but is labelled "not accepted/untested"
  while the `TRUSTED_PROXY=false` branch keeps its unit tests. No git commands run.

- docs(review): design review round 3 — rewrote `.agents/tasks/design-review.md` (narrative) and
  `.agents/tasks/design-review.json` (machine verdict). Verdict `CHANGES_REQUESTED`: 2 HIGH,
  13 MEDIUM, 6 NIT (ids `R3-*`, so they never collide with the `[H1]`…`[N4]` and `[R2-*]` tags
  already embedded in design.md). All 21 round-2 findings have real traces in the text; the two
  HIGH findings are gaps *inside* two of those fixes.
  R3-H1: the R2-H2 rule "keep searching cloud_farm so the §12.4 guard always runs" has no field to
  live in — `searched_domains` belongs to `RetrievalResult`, `RouterResult` has no equivalent, and
  `retrieve()` is called with `router.domains`. Two further paths make the guard unreachable even
  as written: a user-pinned `domain: 'pig_farming'` and a tier-2 `llm` verdict of `pig_farming`
  while `cfScore > 0` both leave `cfSignal === true` with cloud_farm never searched. Fix: make
  `cfSignal === true ⇒ 'cloud_farm' ∈ searched_domains` an invariant, always include cloud_farm
  when the CF store is empty, and let `retrieve()` compute the field from `RouterResult`.
  R3-H2: `findDosages()` only matches digit + unit, but Ch.10 rule 4 also forbids *protocols* and
  *vaccine schedules* — `tiêm vaccine lúc 3 tuần tuổi, nhắc lại sau 4 tuần`, `2 lần/ngày` and
  `dùng kháng sinh … trong vài ngày` all return empty, so they stream straight to the user while
  §20 still claims rule 4 is fully code-enforced. Fix: a third `protocol` tier plus week/frequency
  units and spelled-out numbers, with `protocol` items grounded only when `approvedVetBasis()` is
  non-empty, and §20 downgraded to the honest "mức máy" wording already used for rule 3.
  Verified by running: the 7 Ch.10 rules in design.md match the proposal byte-for-byte and in order
  (both files NFC, BOM `EF BB BF` present, LF only, each marker unique, exactly 7 extracted lines);
  `.gitignore` still carries only the `data/kb-index.json` line to remove and nothing matching
  `*.bin`; Node v24.19.0, npm 11.17.0, Git present outside PATH; clock now reads 2026-11-06, so the
  `2026-11-01` sample dates stay in the past. No git commands run.

- setup: khởi tạo pha implement — thư mục .agents\tasks sẵn sàng, đã xác nhận 5 tài liệu đầu vào đọc được.

- feat(FEAT-001): nền tảng — scaffold Next.js 15.5.29 + React 19 + Tailwind 3.4 + Vitest 3,
  hai thay đổi repo bắt buộc (bỏ `data/kb-index.json` khỏi `.gitignore`; thêm `.gitattributes`
  đúng 3 dòng để `core.autocrlf` trên Windows không phá `kb-vectors.bin` âm thầm), kiểu dùng
  chung `lib/kb/types.ts` + `lib/llm/types.ts` + `lib/embedding/types.ts` (đã áp 8 finding
  vòng 3: `ContextChunks`/`toContextChunks`, `excluded_expired` theo miền, ba field truy vết
  bản dịch/thay thế, `ctx: Ctx` thay `signal`, `finish_reason: 'refused'`, `vectors_file`,
  `Notice.code` còn đúng 5 mã), `lib/config/env.ts` (lười, KHÔNG throw lúc import; key chỉ
  validate `min(1)`; 11 khoảng hợp lệ ⇒ ngoài khoảng thì mặc định + warn một lần; kiểm chéo
  ngân sách prompt ngay lúc đọc env; mock ghi đè `RETRIEVAL_MIN_COSINE` về 0.05), `lib/util/*`
  (`http.ts` là nơi chính sách retry sống: 429+5xx, không retry 400/401/403/404,
  `canRetry(ctx, …)` nhận `ctx` qua THAM SỐ), và hai họ adapter LLM + embedding kèm `mock`.
  **L2-normalize nằm ở TẦNG ADAPTER** (`lib/embedding/{gemini,openai-compatible,mock}.ts`),
  trên MỌI vector, ở CẢ `kind:'document'` VÀ `kind:'query'` — KHÔNG ở `scripts/ingest.ts`
  (R3-M7): vector Gemini 768 chiều đo được chuẩn 0,592158 nên chỉ normalize lúc ingest thì
  vector câu hỏi vẫn lệch và RAG xếp hạng sai tài liệu mà không crash, không log.
  Đã kiểm chứng thật 4 giả định §21.2 và ghi vào `verify-gemini.md` mục 6: react-markdown@9.1.0
  escape HTML thô (không có `rehype-raw`), `outputFileTracingIncludes` top-level được Next
  15.5.29 nhận, `NextRequest.ip` và `.geo` đã bị bỏ, và trần Hobby là **300s** chứ không phải
  60s — giữ `DEADLINE_MS = 50_000` với `maxDuration = 60` tường minh, lý do ghi ở
  `docs/MAPPING.md`. Xác minh: typecheck 0 lỗi; 10 file / 123 test pass; `next lint` sạch;
  `next build` exit 0; `.gitignore` không còn dòng `kb-index`. Không chạy lệnh git nào.
