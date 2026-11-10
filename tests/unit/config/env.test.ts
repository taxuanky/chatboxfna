import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GLOSSARY_TOKEN_CAP,
  MESSAGE_TOKEN_CAP,
  SYSTEM_PROMPT_TOKEN_CAP,
  getAuthConfig,
  getEmbeddingConfig,
  getLlmConfig,
  getRetrievalConfig,
  parseRateLimit,
} from '@/lib/config/env';
import { MOCK_EMBEDDING_DIM, MOCK_MIN_COSINE } from '@/lib/embedding/mock';
import { resetLogOnceForTests } from '@/lib/util/logger';

const KEYS = [
  'APP_PASSWORD', 'SESSION_SECRET', 'SESSION_TTL_HOURS', 'TRUSTED_PROXY',
  'LLM_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS',
  'GEMINI_BASE_URL', 'GEMINI_THINKING_LEVEL', 'GEMINI_ALLOW_NONSTREAM_FALLBACK',
  'EMBEDDING_PROVIDER', 'EMBEDDING_MODEL', 'EMBEDDING_DIMENSION', 'EMBEDDING_API_KEY',
  'EMBEDDING_BASE_URL', 'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL',
  'KB_INDEX_PATH', 'RETRIEVAL_TOP_K', 'RETRIEVAL_MIN_COSINE', 'RETRIEVAL_MAX_PER_DOC',
  'RETRIEVAL_CONTEXT_TOKEN_BUDGET', 'CHUNK_MAX_TOKENS', 'CHUNK_MIN_TOKENS',
  'CHUNK_OVERLAP_TOKENS', 'HISTORY_TOKEN_BUDGET', 'PROMPT_TOKEN_BUDGET_TOTAL',
  'LLM_ATTEMPT_TIMEOUT_MS', 'RATE_LIMIT_LOGIN', 'RATE_LIMIT_LOGIN_GLOBAL',
  'RATE_LIMIT_CHAT', 'LOG_LEVEL',
];

let warnSpy: ReturnType<typeof vi.spyOn>;
let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetLogOnceForTests();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  infoSpy.mockRestore();
  for (const k of KEYS) delete process.env[k];
});

describe('không throw lúc import, không throw khi thiếu cấu hình', () => {
  it('thiếu GEMINI_API_KEY ⇒ {ok:false} kèm message tiếng Việt, KHÔNG throw', () => {
    const result = getLlmConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('GEMINI_API_KEY');
    expect(result.message).toContain('GEMINI_API_KEY');
  });

  it('thiếu APP_PASSWORD và SESSION_SECRET ⇒ {ok:false}, KHÔNG throw', () => {
    const result = getAuthConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(['APP_PASSWORD', 'SESSION_SECRET']);
  });
});

describe('validate API key: CHỈ kiểm tra không rỗng', () => {
  // Đây là yêu cầu cứng, đã đo thật: key AI Studio hiện có dạng `AQ.Ab8...` 53 ký tự.
  // Regex ép tiền tố `AIza` hay ép độ dài 39 sẽ TỪ CHỐI KEY HỢP LỆ.
  // Fixture phải TỰ BỊA HOÀN TOÀN: không chứa bất kỳ ký tự nào của key thật,
  // kể cả vài ký tự đầu. Repo này public.
  const AQ_53 = `AQ.${'FAKE'.repeat(12)}XX`;
  const AIZA_39 = `AIzaSy${'0'.repeat(32)}X`;

  it.each([
    ['AQ. dài 53', AQ_53],
    ['AIza dài 39', AIZA_39],
  ])('%s đều pass', (_label, key) => {
    process.env.GEMINI_API_KEY = key;
    const result = getLlmConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.apiKey).toBe(key);
  });

  it('độ dài thật của hai định dạng khác nhau — test không tự giả định một con số', () => {
    expect(AQ_53).toHaveLength(53);
    expect(AIZA_39).toHaveLength(39);
  });
});

describe('SESSION_SECRET', () => {
  it('31 ký tự ⇒ {ok:false} với message nêu "ít nhất 32 ký tự"', () => {
    process.env.APP_PASSWORD = 'matkhau-chung';
    process.env.SESSION_SECRET = 'x'.repeat(31);
    const result = getAuthConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('ít nhất 32 ký tự');
    expect(result.missing).toEqual(['SESSION_SECRET']);
  });

  it('32 ký tự ⇒ ok', () => {
    process.env.APP_PASSWORD = 'matkhau-chung';
    process.env.SESSION_SECRET = 'x'.repeat(32);
    expect(getAuthConfig().ok).toBe(true);
  });
});

describe('giá trị ngoài khoảng ⇒ mặc định + warn MỘT LẦN, không throw', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = 'matkhau-chung';
    process.env.SESSION_SECRET = 'x'.repeat(40);
  });

  it('RETRIEVAL_TOP_K=0 ⇒ 6', () => {
    process.env.RETRIEVAL_TOP_K = '0';
    const result = getRetrievalConfig();
    expect(result.ok && result.config.topK).toBe(6);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('RETRIEVAL_TOP_K=21 ⇒ 6', () => {
    process.env.RETRIEVAL_TOP_K = '21';
    const result = getRetrievalConfig();
    expect(result.ok && result.config.topK).toBe(6);
  });

  it('SESSION_TTL_HOURS=0 ⇒ 8', () => {
    process.env.SESSION_TTL_HOURS = '0';
    const result = getAuthConfig();
    expect(result.ok && result.config.sessionTtlHours).toBe(8);
  });

  it('CHUNK_MIN_TOKENS > CHUNK_MAX_TOKENS ⇒ mặc định 80 (ràng buộc liên-biến)', () => {
    process.env.CHUNK_MAX_TOKENS = '256';
    process.env.CHUNK_MIN_TOKENS = '512';
    const result = getRetrievalConfig();
    expect(result.ok && result.config.chunkMaxTokens).toBe(256);
    expect(result.ok && result.config.chunkMinTokens).toBe(80);
  });

  it('LLM_ATTEMPT_TIMEOUT_MS=60000 ⇒ 20000 (phải chừa chỗ cho canRetry trong deadline 50s)', () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.LLM_ATTEMPT_TIMEOUT_MS = '60000';
    const result = getLlmConfig();
    expect(result.ok && result.config.attemptTimeoutMs).toBe(20_000);
  });

  it('warn chỉ phát MỘT LẦN cho cùng một biến dù gọi nhiều lượt', () => {
    process.env.RETRIEVAL_TOP_K = '99';
    getRetrievalConfig();
    getRetrievalConfig();
    getRetrievalConfig();
    const topKWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('RETRIEVAL_TOP_K'));
    expect(topKWarnings).toHaveLength(1);
  });
});

describe('RATE_LIMIT_* — [N1]', () => {
  it.each([
    ['5/15m', 5, 15 * 60_000],
    ['20/5m', 20, 5 * 60_000],
    ['30/15m', 30, 15 * 60_000],
    ['10/30s', 10, 30_000],
    ['100/1h', 100, 3_600_000],
  ])('parse %s', (raw, limit, windowMs) => {
    expect(parseRateLimit(raw)).toEqual({ limit, windowMs, raw });
  });

  it.each(['abc', '5/15x', '', '5-15m', '12345/15m'])('từ chối %s', (raw) => {
    expect(parseRateLimit(raw)).toBeNull();
  });

  it('định dạng sai ⇒ dùng mặc định + warn một lần, KHÔNG throw', () => {
    process.env.APP_PASSWORD = 'matkhau-chung';
    process.env.SESSION_SECRET = 'x'.repeat(40);
    process.env.RATE_LIMIT_CHAT = '5/15x';
    const result = getAuthConfig();
    expect(result.ok && result.config.rateLimitChat.raw).toBe('20/5m');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('kiểm chéo ngân sách prompt — [R3-M6]', () => {
  it('mặc định 3500 + 1000 + 1000 + 200 + 600 = 6300 <= 6500 ⇒ KHÔNG kích hoạt', () => {
    const result = getRetrievalConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { contextTokenBudget, historyTokenBudget, promptTokenBudgetTotal } = result.config;
    expect(contextTokenBudget).toBe(3500);
    expect(historyTokenBudget).toBe(1000);
    expect(promptTokenBudgetTotal).toBe(6500);
    const fixed = SYSTEM_PROMPT_TOKEN_CAP + GLOSSARY_TOKEN_CAP + MESSAGE_TOKEN_CAP;
    expect(contextTokenBudget + historyTokenBudget + fixed).toBe(6300);
    expect(contextTokenBudget + historyTokenBudget + fixed).toBeLessThanOrEqual(
      promptTokenBudgetTotal,
    );
    const budgetWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('Ngân sách'));
    expect(budgetWarnings).toHaveLength(0);
  });

  it('tổng 5 cấu phần vượt TOTAL ⇒ dùng mặc định cho cả ba biến + warn một lần', () => {
    process.env.RETRIEVAL_CONTEXT_TOKEN_BUDGET = '8000';
    process.env.HISTORY_TOKEN_BUDGET = '4000';
    process.env.PROMPT_TOKEN_BUDGET_TOTAL = '6500';
    const result = getRetrievalConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.contextTokenBudget).toBe(3500);
    expect(result.config.historyTokenBudget).toBe(1000);
    expect(result.config.promptTokenBudgetTotal).toBe(6500);
    const budgetWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('Ngân sách'));
    expect(budgetWarnings).toHaveLength(1);
  });

  it('PROMPT_TOKEN_BUDGET_TOTAL ngoài khoảng 2500-30000 ⇒ mặc định 6500', () => {
    process.env.PROMPT_TOKEN_BUDGET_TOTAL = '2000';
    const result = getRetrievalConfig();
    expect(result.ok && result.config.promptTokenBudgetTotal).toBe(6500);
  });
});

describe('ghi đè khi provider embedding là mock — [R3-M10][M19]', () => {
  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'mock';
  });

  it('RETRIEVAL_MIN_COSINE bị ghi đè về 0.05 (không phải 0) dù env đặt tường minh', () => {
    process.env.RETRIEVAL_MIN_COSINE = '0.8';
    const result = getRetrievalConfig();
    expect(result.ok && result.config.minCosine).toBe(MOCK_MIN_COSINE);
    expect(MOCK_MIN_COSINE).toBeGreaterThan(0);
  });

  it('số chiều luôn 256 và EMBEDDING_DIMENSION=768 bị bỏ qua kèm warn', () => {
    process.env.EMBEDDING_DIMENSION = '768';
    const result = getEmbeddingConfig();
    expect(result.ok && result.config.dimension).toBe(MOCK_EMBEDDING_DIM);
    expect(result.ok && result.config.model).toBe('mock-bow-hash-v1');
    const dimWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('EMBEDDING_DIMENSION'));
    expect(dimWarnings).toHaveLength(1);
  });

  it('provider mock không cần key nào', () => {
    expect(getEmbeddingConfig().ok).toBe(true);
    process.env.LLM_PROVIDER = 'mock';
    expect(getLlmConfig().ok).toBe(true);
  });
});

describe('fallback key embedding — [M11]', () => {
  it('EMBEDDING_API_KEY trống + provider gemini ⇒ dùng GEMINI_API_KEY', () => {
    process.env.GEMINI_API_KEY = 'AQ.khoa-chung';
    const result = getEmbeddingConfig();
    expect(result.ok && result.config.apiKey).toBe('AQ.khoa-chung');
  });

  it('provider openai-compatible KHÔNG BAO GIỜ mượn GEMINI_API_KEY', () => {
    process.env.EMBEDDING_PROVIDER = 'openai-compatible';
    process.env.EMBEDDING_BASE_URL = 'https://api.openai.com/v1';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.GEMINI_API_KEY = 'AQ.khoa-gemini';
    const result = getEmbeddingConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('EMBEDDING_API_KEY');
  });
});

describe('LLM openai-compatible', () => {
  it('host loopback cho phép key rỗng (Ollama local)', () => {
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
    process.env.LLM_MODEL = 'llama3';
    expect(getLlmConfig().ok).toBe(true);
  });

  it('host không loopback mà thiếu key ⇒ {ok:false}', () => {
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_MODEL = 'gpt-4o-mini';
    const result = getLlmConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('LLM_API_KEY');
  });
});

describe('mặc định của đường Gemini', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'AQ.khoa';
  });

  it('model mặc định là gemini-3.5-flash và danh sách fallback TRỐNG', () => {
    const result = getLlmConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.model).toBe('gemini-3.5-flash');
    expect(result.config.fallbackModels).toEqual([]);
    expect(result.config.allowNonstreamFallback).toBe(true);
  });

  it('GEMINI_FALLBACK_MODELS tách theo dấu phẩy khi được khai tường minh', () => {
    process.env.GEMINI_FALLBACK_MODELS = 'gemini-3.8-flash, gemini-flash-latest';
    const result = getLlmConfig();
    expect(result.ok && result.config.fallbackModels)
      .toEqual(['gemini-3.8-flash', 'gemini-flash-latest']);
  });
});

describe('KB_INDEX_PATH — [R3-N3]', () => {
  it('đường dẫn mặc định không sinh cảnh báo', () => {
    getRetrievalConfig();
    const pathWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('KB_INDEX_PATH'));
    expect(pathWarnings).toHaveLength(0);
  });

  it('đổi ra ngoài ./data/ ⇒ cảnh báo nói rõ hậu quả INDEX_MISSING trên Vercel', () => {
    process.env.KB_INDEX_PATH = '/tmp/kb-index.json';
    getRetrievalConfig();
    const pathWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('KB_INDEX_PATH'));
    expect(pathWarnings).toHaveLength(1);
    expect(String(pathWarnings[0][0])).toContain('INDEX_MISSING');
  });
});
