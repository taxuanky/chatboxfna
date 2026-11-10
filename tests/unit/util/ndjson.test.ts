import { describe, expect, it } from 'vitest';
import { NdjsonDecoder, decodeNdjson, encodeNdjson, encodeNdjsonLines } from '@/lib/util/ndjson';

describe('NDJSON', () => {
  const events = [
    { type: 'meta', streaming: false },
    { type: 'token', text: 'Xin chào' },
    { type: 'done', finish_reason: 'stop' },
  ];

  it('encode/decode khứ hồi', () => {
    expect(decodeNdjson(encodeNdjsonLines(events))).toEqual(events);
  });

  it('mỗi dòng kết thúc bằng \\n', () => {
    expect(encodeNdjson({ a: 1 })).toBe('{"a":1}\n');
  });

  it('một dòng bị cắt giữa hai mảnh TCP vẫn parse đúng', () => {
    const wire = encodeNdjsonLines(events);
    const cut = Math.floor(wire.length / 2);
    const decoder = new NdjsonDecoder();
    const out = [
      ...decoder.push(wire.slice(0, cut)),
      ...decoder.push(wire.slice(cut)),
      ...decoder.flush(),
    ];
    expect(out).toEqual(events);
    expect(decoder.pending).toBe('');
  });

  it('cắt ở từng vị trí byte đều cho cùng kết quả', () => {
    const wire = encodeNdjsonLines(events);
    for (let i = 1; i < wire.length; i += 1) {
      const d = new NdjsonDecoder();
      const out = [...d.push(wire.slice(0, i)), ...d.push(wire.slice(i)), ...d.flush()];
      expect(out).toEqual(events);
    }
  });

  it('dòng cuối không có \\n được flush() xử lý', () => {
    const d = new NdjsonDecoder();
    expect(d.push('{"type":"done"}')).toEqual([]);
    expect(d.pending).not.toBe('');
    expect(d.flush()).toEqual([{ type: 'done' }]);
  });
});
