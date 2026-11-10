import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import {
  GLOSSARY_MATCH_LIMIT,
  buildMatchKeys,
  matchGlossaryTerms,
  normalizeForMatch,
  parseGlossaryMarkdown,
} from '@/lib/kb/glossary';
import type { GlossaryFile, GlossaryTerm } from '@/lib/kb/glossary';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOSSARY_MD = path.join(REPO_ROOT, 'knowledge', '04_Bilingual_Glossary', 'glossary.md');

function term(vi: string, en: string, abbr = ''): GlossaryTerm {
  return { vi, en, abbr, unit: '', note: '', group: '', match_keys: buildMatchKeys({ vi, en, abbr }) };
}

function glossary(...terms: GlossaryTerm[]): GlossaryFile {
  return { version: 1, terms };
}

describe('normalizeForMatch', () => {
  it('bỏ dấu phụ và hạ chữ', () => {
    expect(normalizeForMatch('Nái Hậu Bị')).toBe('nai hau bi');
    expect(normalizeForMatch('SỮA ĐẦU')).toBe('sua dau');
    expect(normalizeForMatch('  FCR  ')).toBe('fcr');
  });

  it('gộp khoảng trắng để "nái  hậu bị" khớp "nái hậu bị"', () => {
    expect(normalizeForMatch('nái  hậu\tbị')).toBe('nai hau bi');
  });
});

describe('khớp theo biên từ', () => {
  const g = glossary(term('hệ số chuyển hoá thức ăn', 'feed conversion ratio', 'FCR'));

  it('"fcr" khớp "FCR" (không phân biệt hoa thường)', () => {
    expect(matchGlossaryTerms('fcr của đàn là bao nhiêu?', g).map((t) => t.abbr)).toEqual(['FCR']);
  });

  it('khớp cả thuật ngữ tiếng Việt có dấu và không dấu', () => {
    expect(matchGlossaryTerms('hệ số chuyển hoá thức ăn tính thế nào?', g)).toHaveLength(1);
    expect(matchGlossaryTerms('he so chuyen hoa thuc an tinh the nao?', g)).toHaveLength(1);
  });

  it('"nái" KHÔNG khớp bên trong "khoái"', () => {
    const gn = glossary(term('nái', 'sow'));
    expect(matchGlossaryTerms('món này ăn khoái lắm', gn)).toEqual([]);
    expect(matchGlossaryTerms('đàn nái của trại', gn)).toHaveLength(1);
  });

  it('khoá không khớp khi dính chữ số hoặc gạch dưới', () => {
    const gn = glossary(term('nái', 'sow'));
    expect(matchGlossaryTerms('mã nai2 trong sổ', gn)).toEqual([]);
    expect(matchGlossaryTerms('cột nai_hau_bi của bảng', gn)).toEqual([]);
  });
});

describe('ưu tiên cụm dài nhất', () => {
  const g = glossary(term('nái', 'sow'), term('nái hậu bị', 'gilt'));

  it('"nái hậu bị" thắng và KHÔNG trả thêm "nái"', () => {
    const hits = matchGlossaryTerms('chọn nái hậu bị thế nào?', g);
    expect(hits.map((t) => t.en)).toEqual(['gilt']);
  });

  it('cả hai cùng xuất hiện ở hai chỗ khác nhau thì trả cả hai', () => {
    const hits = matchGlossaryTerms('đàn nái và nhóm nái hậu bị', g);
    expect(hits.map((t) => t.en).sort()).toEqual(['gilt', 'sow']);
  });

  it('cùng độ dài khoá thì thứ tự kết quả TẤT ĐỊNH theo vị trí xuất hiện', () => {
    const gg = glossary(term('cai sữa', 'weaning'), term('động dục', 'oestrus'));
    expect(matchGlossaryTerms('sau cai sữa thì động dục trở lại', gg).map((t) => t.en))
      .toEqual(['weaning', 'oestrus']);
    expect(matchGlossaryTerms('động dục trở lại sau cai sữa', gg).map((t) => t.en))
      .toEqual(['oestrus', 'weaning']);
  });
});

describe('trần 10 cặp', () => {
  it('GLOSSARY_MATCH_LIMIT là 10 và kết quả bị cắt đúng ở đó', () => {
    expect(GLOSSARY_MATCH_LIMIT).toBe(10);
    const terms = Array.from({ length: 15 }, (_, i) => term(`thuật ngữ ${i}`, `term ${i}`));
    const question = terms.map((t) => t.vi).join(', ');
    expect(matchGlossaryTerms(question, glossary(...terms))).toHaveLength(10);
  });

  it('limit = 0 trả rỗng', () => {
    expect(matchGlossaryTerms('fcr', glossary(term('fcr', 'fcr')), 0)).toEqual([]);
  });
});

describe('buildMatchKeys', () => {
  it('gồm tiếng Việt, tiếng Anh và viết tắt, bỏ ô rỗng và bỏ trùng', () => {
    expect(buildMatchKeys({ vi: 'Nái hậu bị', en: 'Gilt', abbr: '' }))
      .toEqual(['nai hau bi', 'gilt']);
    expect(buildMatchKeys({ vi: 'ADG', en: 'ADG', abbr: 'ADG' })).toEqual(['adg']);
  });
});

describe('đọc bảng Markdown của knowledge/04_Bilingual_Glossary', () => {
  it('bảng thật có ít nhất 25 mục và mọi mục đủ 6 cột', async () => {
    const raw = await readFile(GLOSSARY_MD, 'utf8');
    const terms = parseGlossaryMarkdown(matter(raw).content);

    expect(terms.length).toBeGreaterThanOrEqual(25);
    for (const t of terms) {
      expect(t.vi.length).toBeGreaterThan(0);
      expect(t.en.length).toBeGreaterThan(0);
      expect(typeof t.abbr).toBe('string');
      expect(typeof t.unit).toBe('string');
      expect(typeof t.note).toBe('string');
      expect(typeof t.group).toBe('string');
      expect(t.match_keys.length).toBeGreaterThan(0);
    }
  });

  it('bảng thật phủ các thuật ngữ được nêu tên trong đề án', async () => {
    const raw = await readFile(GLOSSARY_MD, 'utf8');
    const terms = parseGlossaryMarkdown(matter(raw).content);
    const keys = new Set(terms.flatMap((t) => t.match_keys));

    for (const required of [
      'adg', 'fcr', 'psy', 'ty le chet', 'ty le de', 'so con cai sua', 'nai hau bi',
      'nai mang thai', 'nai nuoi con', 'grower', 'finisher', 'nursery', 'sua dau',
      'an toan sinh hoc', 'sat trung', 'phac do', 'cai sua', 'dong duc', 'phoi giong',
      'lua', 'so con so sinh song', 'trong luong cai sua', 'nang suat nai', 'khau phan',
      'thuc an hon hop', 'cach ly', 'tieu huy', 'thong gio', 'mat do nuoi',
    ]) {
      expect(keys.has(required), `thiếu thuật ngữ "${required}"`).toBe(true);
    }
  });

  it('bỏ dòng tiêu đề và dòng phân cách', () => {
    const md = [
      '| Tiếng Việt | English | Viết tắt | Đơn vị | Giải thích ngắn | Nhóm |',
      '|---|---|---|---|---|---|',
      '| cai sữa | weaning | | | Tách lợn con khỏi nái. | Sinh sản |',
    ].join('\n');
    const terms = parseGlossaryMarkdown(md);
    expect(terms).toHaveLength(1);
    expect(terms[0].vi).toBe('cai sữa');
  });

  it('khớp được một thuật ngữ thật từ bảng thật', async () => {
    const raw = await readFile(GLOSSARY_MD, 'utf8');
    const file: GlossaryFile = { version: 1, terms: parseGlossaryMarkdown(matter(raw).content) };
    const hits = matchGlossaryTerms('FCR và ADG của đàn tính thế nào?', file);
    expect(hits.map((t) => t.abbr).sort()).toEqual(['ADG', 'FCR']);
  });
});
