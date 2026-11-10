/** Factory LLM theo `LLM_PROVIDER` — design.md §6.1. */

import type { LlmConfig } from '@/lib/config/env';
import { getLlmConfig } from '@/lib/config/env';
import { createGeminiLlmProvider } from './gemini';
import { createMockLlmProvider } from './mock';
import { createOpenAiLlmProvider } from './openai-compatible';
import type { LlmProvider } from './types';

export type LlmProviderResult =
  | { ok: true; provider: LlmProvider }
  | { ok: false; code: 'CONFIG_MISSING'; message: string };

export function buildLlmProvider(cfg: LlmConfig): LlmProvider {
  switch (cfg.provider) {
    case 'mock':
      return createMockLlmProvider();
    case 'openai-compatible':
      return createOpenAiLlmProvider({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        attemptTimeoutMs: cfg.attemptTimeoutMs,
      });
    case 'gemini':
    default:
      return createGeminiLlmProvider({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        fallbackModels: cfg.fallbackModels,
        thinkingLevel: cfg.thinkingLevel,
        allowNonstreamFallback: cfg.allowNonstreamFallback,
        attemptTimeoutMs: cfg.attemptTimeoutMs,
      });
  }
}

/** Không throw khi thiếu cấu hình: `/api/chat` phải trả 503 kèm message tiếng Việt. */
export function getLlmProvider(config?: LlmConfig): LlmProviderResult {
  if (config) return { ok: true, provider: buildLlmProvider(config) };
  const result = getLlmConfig();
  if (!result.ok) return { ok: false, code: 'CONFIG_MISSING', message: result.message };
  return { ok: true, provider: buildLlmProvider(result.config) };
}

export type { LlmProvider } from './types';
