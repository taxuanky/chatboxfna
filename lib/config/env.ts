/**
 * Đọc biến môi trường — design.md §6.1.
 *
 * Ba nguyên tắc bất di bất dịch của file này:
 *
 * 1. **KHÔNG throw lúc import.** App phải khởi động được khi thiếu key: trang chat vẫn
 *    render, `ConfigBanner` hiện dải vàng, `/api/chat` trả 503 kèm message tiếng Việt.
 *    Không crash, không stack trace ra UI.
 * 2. **Validate API key CHỈ `z.string().min(1)`.** Key AI Studio hiện có dạng `AQ.Ab8...`
 *    dài 53 ký tự, không còn là `AIza...` 39 ký tự. Viết regex ép tiền tố hay ép độ dài sẽ
 *    TỪ CHỐI KEY HỢP LỆ — đây là lỗi đã xảy ra thật, không phải giả thuyết.
 * 3. **Giá trị số ngoài khoảng ⇒ dùng mặc định + log `warn` MỘT LẦN, không throw.** Cấu
 *    hình sai không được làm sập app, chỉ được để lại vết.
 *
 * Đọc lười, không cache: mỗi lệnh gọi đọc lại `process.env`. Cache sẽ làm cấu hình trên
 * Vercel chỉ có hiệu lực sau khi redeploy, và làm test không thể đổi env giữa các ca.
 */

import { z } from 'zod';
import { logInfoOnce, logWarnOnce } from '@/lib/util/logger';
import {
  MOCK_EMBEDDING_DIM,
  MOCK_EMBEDDING_MODEL,
  MOCK_MIN_COSINE,
} from '@/lib/embedding/mock';
import { MOCK_LLM_MODEL } from '@/lib/llm/mock';
import type { EmbeddingProviderId } from '@/lib/embedding/types';
import type { LlmProviderId } from '@/lib/llm/types';

export type ConfigResult<T> =
  | { ok: true; config: T }
  | { ok: false; missing: string[]; message: string };

// ───────────────────────────── Hằng ngân sách prompt ─────────────────────────────

/** §11.4: system prompt đo ~800 token, trần chốt ở 1000. */
export const SYSTEM_PROMPT_TOKEN_CAP = 1000;
/** §7.4: tối đa 10 cặp thuật ngữ. */
export const GLOSSARY_TOKEN_CAP = 200;
/** §14.2: câu hỏi tối đa 2000 ký tự ÷ 3.5 ≈ 571, chốt 600. */
export const MESSAGE_TOKEN_CAP = 600;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
export const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
export const DEFAULT_EMBEDDING_DIMENSION = 768;
export const DEFAULT_KB_INDEX_PATH = './data/kb-index.json';

const DEFAULTS = {
  SESSION_TTL_HOURS: 8,
  RETRIEVAL_TOP_K: 6,
  RETRIEVAL_MAX_PER_DOC: 2,
  RETRIEVAL_MIN_COSINE: 0.25,
  RETRIEVAL_CONTEXT_TOKEN_BUDGET: 3500,
  CHUNK_MAX_TOKENS: 512,
  CHUNK_MIN_TOKENS: 80,
  CHUNK_OVERLAP_TOKENS: 64,
  LLM_ATTEMPT_TIMEOUT_MS: 20_000,
  HISTORY_TOKEN_BUDGET: 1000,
  /** [R3-M6] 6500, không phải 6000: bảng §11.4 cộng ra tới 6300 ở trần phần cố định. */
  PROMPT_TOKEN_BUDGET_TOTAL: 6500,
  RATE_LIMIT_LOGIN: '5/15m',
  RATE_LIMIT_LOGIN_GLOBAL: '30/15m',
  RATE_LIMIT_CHAT: '20/5m',
} as const;

// ───────────────────────────────── Tiện ích đọc ──────────────────────────────────

const nonEmpty = z.string().min(1);

function raw(name: string): string {
  return (process.env[name] ?? '').trim();
}

function readString(name: string, fallback: string): string {
  const value = raw(name);
  return value === '' ? fallback : value;
}

/**
 * Đọc một số trong khoảng cho phép. Ngoài khoảng (hoặc không phải số) ⇒ mặc định + `warn`
 * một lần. Khoá của log-một-lần là tên biến, nên mỗi biến sai chỉ nói một lần.
 */
function readNumberInRange(
  name: string,
  fallback: number,
  min: number,
  max: number,
  opts: { integer?: boolean } = {},
): number {
  const value = raw(name);
  if (value === '') return fallback;
  const parsed = Number(value);
  const invalid =
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max ||
    (opts.integer === true && !Number.isInteger(parsed));
  if (invalid) {
    logWarnOnce(
      `env:${name}`,
      `${name}="${value}" ngoài khoảng hợp lệ [${min}, ${max}] — dùng mặc định ${fallback}.`,
    );
    return fallback;
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = raw(name).toLowerCase();
  if (value === '') return fallback;
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  logWarnOnce(
    `env:${name}`,
    `${name}="${value}" không phải true/false — dùng mặc định ${fallback}.`,
  );
  return fallback;
}

// ────────────────────────────────── Rate limit ───────────────────────────────────

export interface RateLimitSpec {
  /** Số lần cho phép trong một cửa sổ. */
  limit: number;
  windowMs: number;
  /** Chuỗi gốc, để `/api/health` báo lại đúng thứ người deploy đã khai. */
  raw: string;
}

/** [N1] `<số lần>/<độ dài cửa sổ><s|m|h>`, ví dụ `5/15m`. */
const RATE_LIMIT_RE = /^(\d{1,4})\/(\d{1,4})([smh])$/;

const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000 };

export function parseRateLimit(value: string): RateLimitSpec | null {
  const m = RATE_LIMIT_RE.exec(value.trim());
  if (!m) return null;
  const limit = Number(m[1]);
  const windowValue = Number(m[2]);
  if (limit <= 0 || windowValue <= 0) return null;
  return { limit, windowMs: windowValue * UNIT_MS[m[3]], raw: value.trim() };
}

function readRateLimit(name: string, fallback: string): RateLimitSpec {
  const value = raw(name);
  if (value !== '') {
    const parsed = parseRateLimit(value);
    if (parsed) return parsed;
    logWarnOnce(
      `env:${name}`,
      `${name}="${value}" sai định dạng (cần dạng "5/15m") — dùng mặc định ${fallback}.`,
    );
  }
  // Mặc định là hằng trong code nên chắc chắn parse được.
  return parseRateLimit(fallback) as RateLimitSpec;
}

// ──────────────────────────────────── LLM ────────────────────────────────────────

export interface LlmConfig {
  provider: LlmProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  /** [§6.2] mặc định TRỐNG có chủ đích. */
  fallbackModels: string[];
  /** Chuỗi rỗng ⇒ KHÔNG gửi `thinkingConfig`. */
  thinkingLevel: string;
  allowNonstreamFallback: boolean;
  attemptTimeoutMs: number;
}

function readProvider<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = raw(name).toLowerCase();
  if (value === '') return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  logWarnOnce(
    `env:${name}`,
    `${name}="${value}" không thuộc {${allowed.join(', ')}} — dùng mặc định ${fallback}.`,
  );
  return fallback;
}

function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function getLlmConfig(): ConfigResult<LlmConfig> {
  const provider = readProvider('LLM_PROVIDER', ['gemini', 'openai-compatible', 'mock'], 'gemini');
  const attemptTimeoutMs = readNumberInRange(
    'LLM_ATTEMPT_TIMEOUT_MS', DEFAULTS.LLM_ATTEMPT_TIMEOUT_MS, 5_000, 45_000, { integer: true },
  );

  if (provider === 'mock') {
    return {
      ok: true,
      config: {
        provider, model: MOCK_LLM_MODEL, apiKey: '', baseUrl: '',
        fallbackModels: [], thinkingLevel: '', allowNonstreamFallback: true, attemptTimeoutMs,
      },
    };
  }

  if (provider === 'openai-compatible') {
    const baseUrl = raw('LLM_BASE_URL');
    const model = raw('LLM_MODEL');
    const apiKey = raw('LLM_API_KEY');
    const missing: string[] = [];
    if (!nonEmpty.safeParse(baseUrl).success) missing.push('LLM_BASE_URL');
    if (!nonEmpty.safeParse(model).success) missing.push('LLM_MODEL');
    // Ollama local: host loopback được phép không có key và bỏ hẳn header Authorization (§6.4).
    if (!nonEmpty.safeParse(apiKey).success && !isLoopbackUrl(baseUrl)) missing.push('LLM_API_KEY');
    if (missing.length > 0) {
      return {
        ok: false,
        missing,
        message:
          `Chưa cấu hình đầy đủ cho LLM_PROVIDER=openai-compatible: thiếu ${missing.join(', ')}. ` +
          'Xem README mục "Dùng endpoint tương thích OpenAI".',
      };
    }
    return {
      ok: true,
      config: {
        provider, model, apiKey, baseUrl,
        fallbackModels: [], thinkingLevel: '', allowNonstreamFallback: true, attemptTimeoutMs,
      },
    };
  }

  const apiKey = raw('GEMINI_API_KEY');
  if (!nonEmpty.safeParse(apiKey).success) {
    return {
      ok: false,
      missing: ['GEMINI_API_KEY'],
      message: 'Chưa cấu hình GEMINI_API_KEY — xem README mục "Lấy API key".',
    };
  }
  return {
    ok: true,
    config: {
      provider,
      model: readString('GEMINI_MODEL', DEFAULT_GEMINI_MODEL),
      apiKey,
      baseUrl: readString('GEMINI_BASE_URL', DEFAULT_GEMINI_BASE_URL),
      fallbackModels: raw('GEMINI_FALLBACK_MODELS')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      thinkingLevel: readString('GEMINI_THINKING_LEVEL', 'low'),
      allowNonstreamFallback: readBoolean('GEMINI_ALLOW_NONSTREAM_FALLBACK', true),
      attemptTimeoutMs,
    },
  };
}

// ───────────────────────────────── Embedding ─────────────────────────────────────

export interface EmbeddingConfig {
  provider: EmbeddingProviderId;
  /** [M11] CHỈ dùng lúc `npm run ingest`. Đường query đọc model từ metadata index. */
  model: string;
  /** [M11] CHỈ dùng lúc ingest. */
  dimension: number;
  apiKey: string;
  baseUrl: string;
  attemptTimeoutMs: number;
}

export function getEmbeddingConfig(): ConfigResult<EmbeddingConfig> {
  const provider = readProvider(
    'EMBEDDING_PROVIDER', ['gemini', 'openai-compatible', 'mock'], 'gemini',
  );
  const attemptTimeoutMs = readNumberInRange(
    'LLM_ATTEMPT_TIMEOUT_MS', DEFAULTS.LLM_ATTEMPT_TIMEOUT_MS, 5_000, 45_000, { integer: true },
  );

  if (provider === 'mock') {
    const requested = raw('EMBEDDING_DIMENSION');
    if (requested !== '' && Number(requested) !== MOCK_EMBEDDING_DIM) {
      logWarnOnce(
        'env:EMBEDDING_DIMENSION:mock',
        `EMBEDDING_DIMENSION=${requested} bị BỎ QUA khi EMBEDDING_PROVIDER=mock — ` +
        `số chiều luôn là ${MOCK_EMBEDDING_DIM}.`,
      );
    }
    return {
      ok: true,
      config: {
        provider,
        model: MOCK_EMBEDDING_MODEL,
        dimension: MOCK_EMBEDDING_DIM,
        apiKey: '',
        baseUrl: '',
        attemptTimeoutMs,
      },
    };
  }

  const dimension = readNumberInRange(
    'EMBEDDING_DIMENSION', DEFAULT_EMBEDDING_DIMENSION, 1, 3072, { integer: true },
  );

  if (provider === 'openai-compatible') {
    const baseUrl = readString('EMBEDDING_BASE_URL', raw('LLM_BASE_URL'));
    const apiKey = raw('EMBEDDING_API_KEY');
    const model = raw('EMBEDDING_MODEL');
    const missing: string[] = [];
    if (!nonEmpty.safeParse(baseUrl).success) missing.push('EMBEDDING_BASE_URL');
    if (!nonEmpty.safeParse(model).success) missing.push('EMBEDDING_MODEL');
    // [M11] KHÔNG fallback sang GEMINI_API_KEY ở đây: không bao giờ lặng lẽ gửi key của
    // nhà cung cấp này sang nhà cung cấp khác.
    if (!nonEmpty.safeParse(apiKey).success && !isLoopbackUrl(baseUrl)) {
      missing.push('EMBEDDING_API_KEY');
    }
    if (missing.length > 0) {
      return {
        ok: false,
        missing,
        message:
          `Chưa cấu hình đầy đủ cho EMBEDDING_PROVIDER=openai-compatible: thiếu ${missing.join(', ')}.`,
      };
    }
    return { ok: true, config: { provider, model, dimension, apiKey, baseUrl, attemptTimeoutMs } };
  }

  // [M11] Fallback key CHỈ trong họ Gemini — và là YÊU CẦU BẮT BUỘC HIỆN THỰC: thiếu nó
  // thì bản deploy nào chỉ khai GEMINI_API_KEY sẽ không trả lời được câu nào.
  const apiKey = readString('EMBEDDING_API_KEY', raw('GEMINI_API_KEY'));
  if (!nonEmpty.safeParse(apiKey).success) {
    return {
      ok: false,
      missing: ['EMBEDDING_API_KEY', 'GEMINI_API_KEY'],
      message:
        'Chưa cấu hình EMBEDDING_API_KEY (hoặc GEMINI_API_KEY để dùng chung) — ' +
        'xem README mục "Lấy API key".',
    };
  }
  return {
    ok: true,
    config: {
      provider,
      model: readString('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL),
      dimension,
      apiKey,
      baseUrl: readString('EMBEDDING_BASE_URL', readString('GEMINI_BASE_URL', DEFAULT_GEMINI_BASE_URL)),
      attemptTimeoutMs,
    },
  };
}

// ──────────────────────────────────── Auth ───────────────────────────────────────

export interface AuthConfig {
  appPassword: string;
  sessionSecret: string;
  sessionTtlHours: number;
  trustedProxy: boolean;
  rateLimitLogin: RateLimitSpec;
  rateLimitLoginGlobal: RateLimitSpec;
  rateLimitChat: RateLimitSpec;
}

export const SESSION_SECRET_MIN_LENGTH = 32;

export function getAuthConfig(): ConfigResult<AuthConfig> {
  const appPassword = raw('APP_PASSWORD');
  const sessionSecret = raw('SESSION_SECRET');

  const missing: string[] = [];
  if (!nonEmpty.safeParse(appPassword).success) missing.push('APP_PASSWORD');
  if (!nonEmpty.safeParse(sessionSecret).success) missing.push('SESSION_SECRET');

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      message:
        `Chưa cấu hình ${missing.join(' và ')} — ứng dụng vẫn chạy nhưng mọi yêu cầu bị coi ` +
        'là chưa đăng nhập. Xem README mục "Cấu hình biến môi trường".',
    };
  }

  // [R2-N5] Secret ngắn là "có mặt nhưng không hợp lệ", vẫn dùng mã CONFIG_MISSING vì hệ
  // quả giống hệt (app chạy, mọi request coi như chưa đăng nhập) — nhưng message phải nói
  // đúng bản chất, vì người đọc message mới là người phải sửa.
  if (sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    return {
      ok: false,
      missing: ['SESSION_SECRET'],
      message: `SESSION_SECRET phải dài ít nhất ${SESSION_SECRET_MIN_LENGTH} ký tự.`,
    };
  }

  return {
    ok: true,
    config: {
      appPassword,
      sessionSecret,
      sessionTtlHours: readNumberInRange(
        'SESSION_TTL_HOURS', DEFAULTS.SESSION_TTL_HOURS, 1, 168, { integer: true },
      ),
      trustedProxy: readBoolean('TRUSTED_PROXY', true),
      rateLimitLogin: readRateLimit('RATE_LIMIT_LOGIN', DEFAULTS.RATE_LIMIT_LOGIN),
      rateLimitLoginGlobal: readRateLimit(
        'RATE_LIMIT_LOGIN_GLOBAL', DEFAULTS.RATE_LIMIT_LOGIN_GLOBAL,
      ),
      rateLimitChat: readRateLimit('RATE_LIMIT_CHAT', DEFAULTS.RATE_LIMIT_CHAT),
    },
  };
}

// ────────────────────────────────── Truy xuất ────────────────────────────────────

export interface RetrievalConfig {
  kbIndexPath: string;
  topK: number;
  minCosine: number;
  maxPerDoc: number;
  contextTokenBudget: number;
  historyTokenBudget: number;
  promptTokenBudgetTotal: number;
  chunkMaxTokens: number;
  chunkMinTokens: number;
  chunkOverlapTokens: number;
}

export function getRetrievalConfig(): ConfigResult<RetrievalConfig> {
  const kbIndexPath = readString('KB_INDEX_PATH', DEFAULT_KB_INDEX_PATH);
  // [R3-N3] Đổi đường dẫn ra ngoài ./data/ làm outputFileTracingIncludes (§9.4 — ghi cứng
  // ./data/) không đóng gói đúng file ⇒ INDEX_MISSING trên Vercel, trong khi local chạy tốt.
  if (!/^\.?\/?data\//.test(kbIndexPath.replace(/\\/g, '/'))) {
    logWarnOnce(
      'env:KB_INDEX_PATH',
      `KB_INDEX_PATH="${kbIndexPath}" nằm ngoài ./data/. Trên Vercel, ` +
      'outputFileTracingIncludes chỉ đóng gói ./data/ nên index sẽ không có trong bundle ' +
      '(INDEX_MISSING). Chỉ đổi biến này khi tự host.',
    );
  }

  const embedding = getEmbeddingConfig();
  const embeddingProvider = embedding.ok
    ? embedding.config.provider
    : readProvider('EMBEDDING_PROVIDER', ['gemini', 'openai-compatible', 'mock'], 'gemini');

  let minCosine = readNumberInRange(
    'RETRIEVAL_MIN_COSINE', DEFAULTS.RETRIEVAL_MIN_COSINE, 0, 1,
  );
  if (embeddingProvider === 'mock') {
    // [R3-M10] Ghi đè về 0.05, KHÔNG phải 0 — xem lý do ở lib/embedding/mock.ts.
    minCosine = MOCK_MIN_COSINE;
    logInfoOnce(
      'env:RETRIEVAL_MIN_COSINE:mock',
      `EMBEDDING_PROVIDER=mock: RETRIEVAL_MIN_COSINE được ghi đè về ${MOCK_MIN_COSINE} ` +
      'để nhánh "không liên quan" vẫn kiểm được khi chạy offline.',
    );
  }

  const chunkMaxTokens = readNumberInRange(
    'CHUNK_MAX_TOKENS', DEFAULTS.CHUNK_MAX_TOKENS, 128, 2048, { integer: true },
  );
  const chunkMinTokens = readNumberInRange(
    'CHUNK_MIN_TOKENS', DEFAULTS.CHUNK_MIN_TOKENS, 0, chunkMaxTokens, { integer: true },
  );
  const chunkOverlapTokens = readNumberInRange(
    'CHUNK_OVERLAP_TOKENS', DEFAULTS.CHUNK_OVERLAP_TOKENS, 0, Math.floor(chunkMaxTokens / 2),
    { integer: true },
  );

  let contextTokenBudget = readNumberInRange(
    'RETRIEVAL_CONTEXT_TOKEN_BUDGET', DEFAULTS.RETRIEVAL_CONTEXT_TOKEN_BUDGET, 500, 8000,
    { integer: true },
  );
  let historyTokenBudget = readNumberInRange(
    'HISTORY_TOKEN_BUDGET', DEFAULTS.HISTORY_TOKEN_BUDGET, 0, 4000, { integer: true },
  );
  let promptTokenBudgetTotal = readNumberInRange(
    'PROMPT_TOKEN_BUDGET_TOTAL', DEFAULTS.PROMPT_TOKEN_BUDGET_TOTAL, 2500, 30_000,
    { integer: true },
  );

  /**
   * [R3-M6] Kiểm chéo ngân sách NGAY LÚC ĐỌC ENV, không đợi `assertBudget` lúc chạy.
   *
   * `assertBudget` là lưới an toàn MỖI REQUEST; nếu phép kiểm chỉ sống ở đó thì một cấu
   * hình tự mâu thuẫn sẽ làm MỌI lượt chat có hội thoại dài bị CẮT BỚT CONTEXT âm thầm, và
   * dấu vết chỉ xuất hiện ở lượt đầu tiên của tiến trình. Nói cách khác: trạng thái mặc
   * định của hệ thống sẽ là giảm căn cứ. Với mặc định 3500 + 1000 + 1000 + 200 + 600 =
   * 6300 <= 6500, phép kiểm này KHÔNG được kích hoạt.
   */
  const fixedCaps = SYSTEM_PROMPT_TOKEN_CAP + GLOSSARY_TOKEN_CAP + MESSAGE_TOKEN_CAP;
  if (contextTokenBudget + historyTokenBudget + fixedCaps > promptTokenBudgetTotal) {
    logWarnOnce(
      'env:prompt-budget-crosscheck',
      `Ngân sách prompt tự mâu thuẫn: context ${contextTokenBudget} + history ` +
      `${historyTokenBudget} + phần cố định ${fixedCaps} > tổng ${promptTokenBudgetTotal}. ` +
      'Dùng mặc định cho cả ba biến để không âm thầm cắt bớt căn cứ ở mọi lượt chat.',
    );
    contextTokenBudget = DEFAULTS.RETRIEVAL_CONTEXT_TOKEN_BUDGET;
    historyTokenBudget = DEFAULTS.HISTORY_TOKEN_BUDGET;
    promptTokenBudgetTotal = DEFAULTS.PROMPT_TOKEN_BUDGET_TOTAL;
  }

  return {
    ok: true,
    config: {
      kbIndexPath,
      topK: readNumberInRange('RETRIEVAL_TOP_K', DEFAULTS.RETRIEVAL_TOP_K, 1, 20, { integer: true }),
      minCosine,
      maxPerDoc: readNumberInRange(
        'RETRIEVAL_MAX_PER_DOC', DEFAULTS.RETRIEVAL_MAX_PER_DOC, 1, 5, { integer: true },
      ),
      contextTokenBudget,
      historyTokenBudget,
      promptTokenBudgetTotal,
      chunkMaxTokens,
      chunkMinTokens,
      chunkOverlapTokens,
    },
  };
}
