import { describe, expect, it } from 'vitest';
import {
  MOCK_LLM_ID,
  MOCK_LLM_MODEL,
  MOCK_MARKER_DIAGNOSIS,
  MOCK_MARKER_DOSAGE,
  createMockLlmProvider,
} from '@/lib/llm/mock';
import { getLlmProvider } from '@/lib/llm';
import type { Ctx } from '@/lib/kb/types';
import type { LlmChatRequest, LlmStreamMeta } from '@/lib/llm/types';

const ctx: Ctx = { requestId: 'test', deadline: Date.now() + 60_000 };

function request(system: string, question = 'Lợn con tiêu chảy thì xử lý thế nào?'): LlmChatRequest {
  return { system, messages: [{ role: 'user', content: question }], ctx };
}

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of it) out.push(chunk);
  return out;
}

describe('định danh là hằng số', () => {
  it('id và model cố định, không đọc env', () => {
    const p = createMockLlmProvider();
    expect(p.id).toBe(MOCK_LLM_ID);
    expect(p.model).toBe(MOCK_LLM_MODEL);
    expect(MOCK_LLM_MODEL).toBe('mock-template-v1');
  });

  it('factory trả provider mock khi LLM_PROVIDER=mock, không cần key', () => {
    const result = getLlmProvider({
      provider: 'mock', model: MOCK_LLM_MODEL, apiKey: '', baseUrl: '',
      fallbackModels: [], thinkingLevel: '', allowNonstreamFallback: true,
      attemptTimeoutMs: 20_000,
    });
    expect(result.ok && result.provider.id).toBe('mock');
  });
});

describe('marker để test guard an toàn', () => {
  it('__MOCK_EMIT_DOSAGE__ phát chuỗi CÓ liều thuốc', async () => {
    const out = (await collect(createMockLlmProvider().stream(request(MOCK_MARKER_DOSAGE)))).join('');
    expect(out).toContain('15 mg/kg');
    expect(out).toContain('3 ngày');
  });

  it('__MOCK_EMIT_DIAGNOSIS__ phát một KHẲNG ĐỊNH chẩn đoán', async () => {
    const out = (await collect(
      createMockLlmProvider().stream(request(MOCK_MARKER_DIAGNOSIS)),
    )).join('');
    expect(out).toContain('đàn của bạn bị dịch tả lợn châu Phi');
  });

  it('không có marker ⇒ câu trả lời mẫu, không chứa liều', async () => {
    const out = (await collect(createMockLlmProvider().stream(request('Bạn là trợ lý.')))).join('');
    expect(out).not.toContain('mg/kg');
    expect(out).toContain('provider mock');
  });
});

describe('phát từng từ để UI streaming test được thật', () => {
  it('nhiều mảnh, ghép lại bằng complete()', async () => {
    const p = createMockLlmProvider();
    const req = request('Bạn là trợ lý.');
    const pieces = await collect(p.stream(req));
    expect(pieces.length).toBeGreaterThan(3);
    expect(pieces.join('')).toBe(await p.complete(req));
  });

  it('báo meta streaming=true trước mảnh đầu tiên', async () => {
    const metaRef: { value: LlmStreamMeta | null } = { value: null };
    const req = {
      ...request('Bạn là trợ lý.'),
      onMeta: (m: LlmStreamMeta) => { metaRef.value = m; },
    };
    await collect(createMockLlmProvider().stream(req));
    expect(metaRef.value).toEqual({ streaming: true, model: MOCK_LLM_MODEL });
  });

  it('nút Dừng của UI huỷ được stream giữa dòng', async () => {
    const controller = new AbortController();
    const req: LlmChatRequest = {
      system: 'Bạn là trợ lý.',
      messages: [{ role: 'user', content: 'câu hỏi dài để có nhiều từ' }],
      ctx: { requestId: 'test', deadline: Date.now() + 60_000, signal: controller.signal },
    };
    const out: string[] = [];
    for await (const piece of createMockLlmProvider().stream(req)) {
      out.push(piece);
      if (out.length === 2) controller.abort();
    }
    expect(out).toHaveLength(2);
  });
});
