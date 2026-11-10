/**
 * Adapter chat tương thích OpenAI — design.md §6.4.
 * Một adapter phủ OpenAI, OpenRouter, Groq, DeepSeek, Together và Ollama local, vì tất cả
 * đều nói cùng một giao thức.
 */

import { fetchWithRetry, HttpError } from '@/lib/util/http';
import type { LlmChatRequest, LlmProvider } from './types';

export interface OpenAiLlmOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  attemptTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function createOpenAiLlmProvider(opts: OpenAiLlmOptions): LlmProvider {
  const base = opts.baseUrl.replace(/\/+$/, '');

  function headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    // Ollama local: host loopback cho phép key rỗng và bỏ hẳn header Authorization.
    if (opts.apiKey !== '' || !isLoopback(opts.baseUrl)) {
      h.authorization = `Bearer ${opts.apiKey}`;
    }
    return h;
  }

  function body(req: LlmChatRequest, stream: boolean): string {
    return JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxOutputTokens ?? 2048,
    });
  }

  async function post(req: LlmChatRequest, stream: boolean): Promise<Response> {
    const response = await fetchWithRetry(
      `${base}/chat/completions`,
      { method: 'POST', headers: headers(), body: body(req, stream) },
      { ctx: req.ctx, attemptTimeoutMs: opts.attemptTimeoutMs, fetchImpl: opts.fetchImpl },
    );
    if (!response.ok) {
      throw new HttpError({
        kind: 'http',
        status: response.status,
        message: `Endpoint chat trả ${response.status}.`,
        bodyText: await response.text().catch(() => ''),
      });
    }
    return response;
  }

  return {
    id: 'openai-compatible',
    model: opts.model,

    async *stream(req: LlmChatRequest): AsyncIterable<string> {
      const response = await post(req, true);
      req.onMeta?.({ streaming: true, model: opts.model });
      const bodyStream = response.body;
      if (!bodyStream) throw new HttpError({ kind: 'network', message: 'Response SSE không có body.' });
      const reader = bodyStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          if (req.ctx.signal?.aborted) return;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf('\n');
          while (nl !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf('\n');
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '' ) continue;
            if (payload === '[DONE]') return;
            try {
              const parsed = JSON.parse(payload) as ChatCompletionChunk;
              const text = parsed.choices?.[0]?.delta?.content ?? '';
              if (text !== '') yield text;
            } catch {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },

    async complete(req: LlmChatRequest): Promise<string> {
      const response = await post(req, false);
      const parsed = (await response.json()) as ChatCompletionChunk;
      return parsed.choices?.[0]?.message?.content ?? '';
    },
  };
}
