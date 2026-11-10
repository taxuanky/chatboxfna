import { describe, expect, it } from 'vitest';
import { dot, l2norm, l2normalize } from '@/lib/util/cosine';

describe('dot', () => {
  it('bằng cosine khi cả hai vector đã normalize', () => {
    const a = l2normalize([1, 2, 3]);
    const b = l2normalize([2, 4, 6]);     // cùng hướng
    expect(dot(a, b)).toBeCloseTo(1, 12);
  });

  it('bằng 0 với hai vector vuông góc', () => {
    expect(dot(l2normalize([1, 0]), l2normalize([0, 1]))).toBeCloseTo(0, 12);
  });

  it('throw khi số chiều lệch — không im lặng trả điểm vô nghĩa', () => {
    expect(() => dot([1, 2], [1, 2, 3])).toThrow(/số chiều lệch/i);
  });
});

describe('l2normalize', () => {
  it('đưa chuẩn về 1', () => {
    const v = l2normalize([3, 4]);
    expect(l2norm(v)).toBeCloseTo(1, 12);
  });

  it('vector toàn 0 trả nguyên bản thay vì sinh NaN', () => {
    expect(l2normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('nhận cả Float32Array', () => {
    const v = l2normalize(new Float32Array([1, 1, 1, 1]));
    expect(l2norm(v)).toBeCloseTo(1, 6);
  });
});
