import { describe, expect, it } from 'vitest';
import { CHARS_PER_TOKEN, estimateTokens, trimByTokenBudget } from '@/lib/util/tokens';

describe('estimateTokens', () => {
  it('không trả 0 cho chuỗi không rỗng', () => {
    expect(estimateTokens('a')).toBeGreaterThan(0);
    expect(estimateTokens('ăn')).toBeGreaterThan(0);
    expect(estimateTokens('')).toBe(0);
  });

  it('ổn định và đúng heuristic ceil(chars / 3.5)', () => {
    const text = 'Nhu cầu dinh dưỡng của lợn giai đoạn nursery';
    expect(estimateTokens(text)).toBe(Math.ceil(text.length / CHARS_PER_TOKEN));
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });

  it('tăng đơn điệu theo độ dài', () => {
    expect(estimateTokens('x'.repeat(100))).toBeLessThan(estimateTokens('x'.repeat(1000)));
  });
});

describe('trimByTokenBudget', () => {
  const history = [
    { role: 'user', content: 'a'.repeat(350) },      // ~100 token
    { role: 'assistant', content: 'b'.repeat(350) },
    { role: 'user', content: 'c'.repeat(350) },
  ];

  it('bỏ phần tử CŨ NHẤT trước', () => {
    const kept = trimByTokenBudget(history, 200);
    expect(kept).toHaveLength(2);
    expect(kept[0].content[0]).toBe('b');
    expect(kept[1].content[0]).toBe('c');
  });

  it('giữ nguyên khi còn trong ngân sách', () => {
    expect(trimByTokenBudget(history, 10_000)).toHaveLength(3);
  });

  it('ngân sách 0 ⇒ bỏ hết lịch sử (0 là giá trị hợp lệ: tắt hẳn history)', () => {
    expect(trimByTokenBudget(history, 0)).toEqual([]);
  });

  it('không bao giờ vượt ngân sách', () => {
    const kept = trimByTokenBudget(history, 150);
    const total = kept.reduce((s, m) => s + estimateTokens(m.content), 0);
    expect(total).toBeLessThanOrEqual(150);
  });
});
