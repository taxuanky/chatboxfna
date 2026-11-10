/**
 * Provider LLM `mock` — design.md §6.5 [M19][M16].
 *
 * Mục đích: hoàn tất và test TOÀN BỘ UI streaming + guard an toàn trước khi có key thật.
 */

import type { LlmChatRequest, LlmProvider } from './types';

export const MOCK_LLM_ID = 'mock' as const;
export const MOCK_LLM_MODEL = 'mock-template-v1' as const;

/** Marker trong prompt để test hậu kiểm liều của §12.3 chặn được. */
export const MOCK_MARKER_DOSAGE = '__MOCK_EMIT_DOSAGE__';
/** [M16] Marker để test cảnh báo `NOT_A_DIAGNOSIS` được chèn. */
export const MOCK_MARKER_DIAGNOSIS = '__MOCK_EMIT_DIAGNOSIS__';

const DOSAGE_ANSWER =
  'Theo tài liệu trong kho, cần tiêm 15 mg/kg trong 3 ngày cho đàn có dấu hiệu bệnh.';
const DIAGNOSIS_ANSWER =
  'Căn cứ mô tả, đàn của bạn bị dịch tả lợn châu Phi và cần xử lý ngay.';

export function mockAnswerFor(req: LlmChatRequest): string {
  const haystack = `${req.system}\n${req.messages.map((m) => m.content).join('\n')}`;
  if (haystack.includes(MOCK_MARKER_DOSAGE)) return DOSAGE_ANSWER;
  if (haystack.includes(MOCK_MARKER_DIAGNOSIS)) return DIAGNOSIS_ANSWER;

  const question = req.messages.filter((m) => m.role === 'user').at(-1)?.content.trim() ?? '';
  return (
    'Đây là câu trả lời mẫu của provider mock, dựng từ ngữ cảnh được cung cấp. ' +
    `Câu hỏi nhận được: "${question}". ` +
    'Hãy đối chiếu với khối trích dẫn bên dưới trước khi áp dụng.'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockLlmProvider(): LlmProvider {
  return {
    id: MOCK_LLM_ID,
    model: MOCK_LLM_MODEL,

    async *stream(req: LlmChatRequest): AsyncIterable<string> {
      req.onMeta?.({ streaming: true, model: MOCK_LLM_MODEL });
      const words = mockAnswerFor(req).split(' ');
      for (let i = 0; i < words.length; i += 1) {
        if (req.ctx.signal?.aborted) return;
        // 15 ms mỗi từ: đủ chậm để UI streaming được test THẬT, không phải test một
        // promise đã resolve sẵn.
        await sleep(15);
        yield i === 0 ? words[i] : ` ${words[i]}`;
      }
    },

    async complete(req: LlmChatRequest): Promise<string> {
      return mockAnswerFor(req);
    },
  };
}
