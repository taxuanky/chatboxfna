import { describe, expect, it } from 'vitest';
import { DEFAULT_CHUNK_OPTIONS, chunkDocument, sha256Hex } from '@/lib/kb/chunk';
import { estimateTokens } from '@/lib/util/tokens';

/** Đoạn văn dài `tokens` token xấp xỉ, nội dung thay đổi theo `seed` để hash không trùng. */
function paragraph(seed: string, tokens: number): string {
  const chars = Math.ceil(tokens * 3.5);
  return `${seed} ${'a'.repeat(Math.max(1, chars - seed.length - 1))}`;
}

describe('cắt theo heading (§9.2)', () => {
  it('tách theo ## và ### và giữ heading_path đầy đủ', () => {
    const body = [
      '## Nhu cầu dinh dưỡng',
      paragraph('intro', 120),
      '',
      '### Giai đoạn nursery',
      paragraph('nursery', 120),
      '',
      '### Giai đoạn grower',
      paragraph('grower', 120),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks.map((c) => c.heading_path)).toEqual([
      'Nhu cầu dinh dưỡng',
      'Nhu cầu dinh dưỡng > Giai đoạn nursery',
      'Nhu cầu dinh dưỡng > Giai đoạn grower',
    ]);
  });

  it('phần mở đầu trước heading đầu tiên LUÔN gộp xuôi vào section đầu', () => {
    // Để nó đứng riêng thì sinh một chunk có heading_path rỗng — một trích dẫn không trỏ
    // được vào đâu. Trong kho thật, khối cảnh báo "BẢN THẢO DEMO" là đúng trường hợp này.
    const body = [
      '> ⚠️ BẢN THẢO DEMO — CHƯA ĐƯỢC CHUYÊN GIA DUYỆT.',
      '',
      '## Nhu cầu dinh dưỡng',
      paragraph('intro', 200),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading_path).toBe('Nhu cầu dinh dưỡng');
    expect(chunks[0].text).toContain('BẢN THẢO DEMO');
    expect(chunks.every((c) => c.heading_path !== '')).toBe(true);
  });

  it('tài liệu không có heading nào ⇒ một chunk với heading_path rỗng', () => {
    const chunks = chunkDocument('PIG-NUT-001', paragraph('thuần văn', 100));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].heading_path).toBe('');
  });
});

describe('ngân sách token', () => {
  it('section vượt CHUNK_MAX_TOKENS bị tách theo ranh giới đoạn', () => {
    const body = [
      '## Mục dài',
      paragraph('p1', 300),
      '',
      paragraph('p2', 300),
      '',
      paragraph('p3', 300),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks.length).toBeGreaterThan(1);
    // Mọi chunk đều mang cùng heading_path vì chúng là các phần của một section.
    expect(new Set(chunks.map((c) => c.heading_path))).toEqual(new Set(['Mục dài']));
  });

  it('chồng lấn mang đoạn cuối của chunk trước sang chunk sau', () => {
    const body = [
      '## Mục dài',
      paragraph('đoạn-một', 300),
      '',
      paragraph('đoạn-hai', 15),
      '',
      paragraph('đoạn-ba', 300),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].text).toContain('đoạn-hai');
  });

  it('section dưới CHUNK_MIN_TOKENS gộp với section kế CÙNG CẤP', () => {
    const body = [
      '## Mục A',
      paragraph('ngắn', 10),
      '',
      '## Mục B',
      paragraph('dài', 150),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks).toHaveLength(1);
    // heading_path giữ của section ĐẦU trong cặp gộp: đó là nơi đoạn văn bắt đầu.
    expect(chunks[0].heading_path).toBe('Mục A');
    expect(chunks[0].text).toContain('dài');
  });

  it('section KHÁC CẤP thì không gộp, dù section trước ngắn', () => {
    const body = [
      '## Mục A',
      paragraph('ngắn', 10),
      '',
      '### Mục con',
      paragraph('dài', 150),
    ].join('\n');

    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks.map((c) => c.heading_path)).toEqual(['Mục A', 'Mục A > Mục con']);
  });
});

describe('bảng Markdown KHÔNG bị cắt đôi', () => {
  const header = '| Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm |';
  const sep = '|---|---|---|---|---|---|';
  const rows = Array.from({ length: 60 }, (_, i) =>
    `| thuật ngữ ${i} | term ${i} | T${i} | đơn vị | giải thích khá dài cho đủ độ dài của dòng ${i} | Nhóm |`);
  const table = [header, sep, ...rows].join('\n');

  it('bảng vượt CHUNK_MAX_TOKENS vẫn nằm trọn trong MỘT chunk', () => {
    expect(estimateTokens(table)).toBeGreaterThan(DEFAULT_CHUNK_OPTIONS.maxTokens);

    const chunks = chunkDocument('PIG-GLO-001', `## Bảng thuật ngữ\n\n${table}\n`);
    const withTable = chunks.filter((c) => c.text.includes('| thuật ngữ 0 |'));
    expect(withTable).toHaveLength(1);
    // Mọi dòng của bảng phải nằm trong cùng chunk đó — không dòng nào rơi sang chunk khác.
    for (const row of rows) expect(withTable[0].text).toContain(row);
    expect(withTable[0].token_estimate).toBeGreaterThan(DEFAULT_CHUNK_OPTIONS.maxTokens);
  });

  it('bảng đứng sau một đoạn dài vẫn không bị tách', () => {
    const body = `## Bảng\n\n${paragraph('mở đầu', 400)}\n\n${table}\n`;
    const chunks = chunkDocument('PIG-GLO-001', body);
    const withTable = chunks.filter((c) => c.text.includes('| thuật ngữ 0 |'));
    expect(withTable).toHaveLength(1);
    for (const row of rows) expect(withTable[0].text).toContain(row);
  });
});

describe('chunk_id và content_hash tất định', () => {
  const body = [
    '## Mục A',
    paragraph('a', 120),
    '',
    '## Mục B',
    paragraph('b', 120),
  ].join('\n');

  it('chunk_id là <document_id>#<3 chữ số> tăng dần', () => {
    const chunks = chunkDocument('PIG-NUT-001', body);
    expect(chunks.map((c) => c.chunk_id)).toEqual(['PIG-NUT-001#000', 'PIG-NUT-001#001']);
  });

  it('chạy lại cho kết quả giống hệt', () => {
    expect(chunkDocument('PIG-NUT-001', body)).toEqual(chunkDocument('PIG-NUT-001', body));
  });

  it('content_hash là sha256 của chính text', () => {
    const chunks = chunkDocument('PIG-NUT-001', body);
    for (const chunk of chunks) {
      expect(chunk.content_hash).toBe(sha256Hex(chunk.text));
      expect(chunk.content_hash).toHaveLength(64);
    }
  });

  it('đổi một ký tự trong text ⇒ đổi content_hash (bước tái dùng vector dựa vào điều này)', () => {
    const single = `## Mục A\n\n${paragraph('a', 120)}`;
    const before = chunkDocument('PIG-NUT-001', single);
    const after = chunkDocument('PIG-NUT-001', `${single}.`);
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(before[0].content_hash).not.toBe(after[0].content_hash);
  });

  it('chunk KHÔNG đổi thì content_hash KHÔNG đổi, dù chunk khác trong cùng tài liệu có đổi', () => {
    // Đây là tính chất mà bước 9 của ingest dựa vào: sửa một mục không làm gọi lại API
    // embedding cho toàn bộ tài liệu.
    const before = chunkDocument('PIG-NUT-001', body);
    const after = chunkDocument('PIG-NUT-001', `${body}.`);
    expect(after[0].content_hash).toBe(before[0].content_hash);
    expect(after[1].content_hash).not.toBe(before[1].content_hash);
  });
});
