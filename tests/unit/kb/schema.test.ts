import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANIMAL_STAGES,
  APPROVED_MIN_QUALITY_SCORE,
  PATH_CHECK_EXEMPT,
  PATH_TAXONOMY,
  buildFrontmatterSchema,
  checkBody,
  checkCrossDocument,
  checkPathTaxonomy,
  collectWarnings,
  dirKeyOf,
  enforceChapter9,
  formatIssue,
  glossaryFileSchema,
  isExpired,
  lookupTaxonomy,
  sourcesFileSchema,
  weightedQualityScore,
} from '@/lib/kb/schema';
import type { Frontmatter } from '@/lib/kb/schema';

/** Mốc đồng hồ CỐ ĐỊNH của bộ test — xem [H4]: kết quả không được đổi theo ngày chạy. */
const FROZEN_NOW = new Date('2026-11-05T00:00:00Z');

function baseFrontmatter(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    document_id: 'PIG-NUT-001',
    domain: 'pig_farming',
    category: 'PIG-05',
    doc_kind: 'general_guidance',
    subcategory: 'Nhu cầu dinh dưỡng',
    title: 'Nhu cầu dinh dưỡng theo giai đoạn',
    source: 'Nội bộ – bản thảo demo',
    source_url: null,
    language: 'vi',
    publication_date: '2026-11-01',
    version: '1.0',
    last_reviewed: '2026-11-01',
    license_status: 'internal_draft',
    verification_status: 'in_review',
    reviewer: null,
    ...overrides,
  };
}

/** `now` lấy từ đồng hồ ĐÃ ĐÓNG BĂNG, truyền vào qua THAM SỐ chứ không đọc trong schema. */
function parse(input: Record<string, unknown>) {
  return buildFrontmatterSchema({ now: new Date() }).safeParse(input);
}

function errorFields(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PATH_TAXONOMY (§7.0 [H3])', () => {
  it('phủ đúng 23 thư mục có thể chứa .md', () => {
    expect(Object.keys(PATH_TAXONOMY)).toHaveLength(23);
  });

  it('03_Vietnam_Legal thuộc miền pig_farming và mang doc_kind legal_regulation', () => {
    // Đề án chỉ có HAI miền (Ch.3): pháp luật là CĂN CỨ cho miền chăn nuôi, không phải
    // miền thứ ba. Cái phân biệt nó là doc_kind.
    for (const dir of ['Animal_Husbandry', 'Veterinary', 'Environment']) {
      const entry = lookupTaxonomy(`03_Vietnam_Legal/${dir}`);
      expect(entry).toEqual({
        domain: 'pig_farming', category: 'PIG-LEGAL', doc_kind: 'legal_regulation',
      });
    }
  });

  it('04_Bilingual_Glossary có category PIG-GLOSSARY', () => {
    expect(lookupTaxonomy('04_Bilingual_Glossary')).toEqual({
      domain: 'pig_farming', category: 'PIG-GLOSSARY', doc_kind: 'general_guidance',
    });
  });

  it('hai thư mục CF ngoài Ch.5.2 dùng lại mã gần nghĩa nhất', () => {
    expect(lookupTaxonomy('02_Cloud_Farm/06_Reports_KPI')?.category).toBe('CF-05');
    expect(lookupTaxonomy('02_Cloud_Farm/07_Troubleshooting')?.category).toBe('CF-04');
  });

  it('dirKeyOf lấy đúng thư mục chứa file, kể cả khi dùng dấu \\', () => {
    expect(dirKeyOf('01_Pig_Farming/05_Nutrition/PIG-NUT-001.md')).toBe('01_Pig_Farming/05_Nutrition');
    expect(dirKeyOf('01_Pig_Farming\\05_Nutrition\\PIG-NUT-001.md')).toBe('01_Pig_Farming/05_Nutrition');
    expect(dirKeyOf('PIG-NUT-001.md')).toBe('');
  });
});

describe('đối chiếu đường dẫn (§9.1 bước 3)', () => {
  const fm = {
    domain: 'pig_farming' as const,
    category: 'PIG-05' as const,
    doc_kind: 'general_guidance' as const,
    valid_to: null,
    superseded_by: null,
  };

  it('thư mục đúng ⇒ 0 lỗi', () => {
    expect(checkPathTaxonomy({
      relPath: '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md', fm, now: FROZEN_NOW,
    })).toEqual([]);
  });

  it('thư mục LẠ ⇒ lỗi cứng, thông báo nhắc bổ sung bảng', () => {
    const issues = checkPathTaxonomy({
      relPath: '08_Something_New/PIG-NUT-009.md', fm, now: FROZEN_NOW,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].field).toBe('path');
    expect(issues[0].message).toContain('PATH_TAXONOMY');
  });

  it('category lệch bảng ⇒ lỗi cứng', () => {
    const issues = checkPathTaxonomy({
      relPath: '01_Pig_Farming/05_Nutrition/PIG-NUT-001.md',
      fm: { ...fm, category: 'PIG-11' },
      now: FROZEN_NOW,
    });
    expect(issues.map((i) => i.field)).toEqual(['category']);
  });

  it('domain lệch bảng ⇒ lỗi cứng (bắt đặt sai thư mục)', () => {
    const issues = checkPathTaxonomy({
      relPath: '02_Cloud_Farm/02_SOP/CF-SOP-001.md',
      fm: { ...fm, domain: 'pig_farming', category: 'CF-02', doc_kind: 'internal_sop' },
      now: FROZEN_NOW,
    });
    expect(issues.map((i) => i.field)).toEqual(['domain']);
  });

  describe('07_Archived_Superseded (miễn đối chiếu + ràng buộc bù)', () => {
    it('thiếu CẢ valid_to quá hạn VÀ superseded_by ⇒ lỗi cứng', () => {
      const issues = checkPathTaxonomy({
        relPath: '07_Archived_Superseded/PIG-NUT-004.md',
        fm: { ...fm, valid_to: null, superseded_by: null },
        now: FROZEN_NOW,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('ràng buộc bù');
    });

    it('chỉ có superseded_by ⇒ hợp lệ', () => {
      expect(checkPathTaxonomy({
        relPath: '07_Archived_Superseded/PIG-NUT-004.md',
        fm: { ...fm, valid_to: null, superseded_by: 'PIG-NUT-001' },
        now: FROZEN_NOW,
      })).toEqual([]);
    });

    it('chỉ có valid_to đã qua ⇒ hợp lệ; valid_to còn hiệu lực ⇒ lỗi', () => {
      expect(checkPathTaxonomy({
        relPath: '07_Archived_Superseded/PIG-NUT-004.md',
        fm: { ...fm, valid_to: '2026-11-03', superseded_by: null },
        now: FROZEN_NOW,
      })).toEqual([]);
      expect(checkPathTaxonomy({
        relPath: '07_Archived_Superseded/PIG-NUT-004.md',
        fm: { ...fm, valid_to: '2027-01-01', superseded_by: null },
        now: FROZEN_NOW,
      })).toHaveLength(1);
    });

    it('được miễn đối chiếu category/domain với đường dẫn', () => {
      expect(checkPathTaxonomy({
        relPath: '07_Archived_Superseded/CF-SOP-001.md',
        fm: { domain: 'cloud_farm', category: 'CF-02', doc_kind: 'internal_sop', valid_to: null, superseded_by: 'PIG-NUT-001' },
        now: FROZEN_NOW,
      })).toEqual([]);
    });

    it('PATH_CHECK_EXEMPT chỉ có đúng một thư mục', () => {
      expect(PATH_CHECK_EXEMPT).toEqual(['07_Archived_Superseded']);
    });
  });
});

describe('quy tắc ngày — đồng hồ là THAM SỐ [H4]', () => {
  it('2026-11-01 pass và 2026-11-06 fail với đồng hồ giả 2026-11-05', () => {
    expect(parse(baseFrontmatter({ publication_date: '2026-11-01' })).success).toBe(true);

    const future = parse(baseFrontmatter({ publication_date: '2026-11-06' }));
    expect(future.success).toBe(false);
    expect(errorFields(future)).toContain('publication_date');
  });

  it('đúng ngày hôm nay vẫn hợp lệ (biên không bị loại)', () => {
    expect(parse(baseFrontmatter({
      publication_date: '2026-11-05', last_reviewed: '2026-11-05',
    })).success).toBe(true);
  });

  it('last_reviewed ở tương lai ⇒ lỗi cứng', () => {
    expect(errorFields(parse(baseFrontmatter({ last_reviewed: '2026-12-01' }))))
      .toContain('last_reviewed');
  });

  it('kết quả KHÔNG đổi khi đồng hồ thật chạy tới một năm sau', () => {
    const schemaAtFrozen = buildFrontmatterSchema({ now: FROZEN_NOW });
    vi.setSystemTime(new Date('2027-11-05T00:00:00Z'));
    // Cùng một schema, cùng một `now` ⇒ cùng kết quả, dù đồng hồ hệ thống đã đi xa.
    expect(schemaAtFrozen.safeParse(baseFrontmatter({ publication_date: '2026-11-06' })).success)
      .toBe(false);
    expect(schemaAtFrozen.safeParse(baseFrontmatter({ publication_date: '2026-11-01' })).success)
      .toBe(true);
  });

  it('js-yaml trả Date cho ngày không ngoặc ⇒ vẫn parse được', () => {
    expect(parse(baseFrontmatter({
      publication_date: new Date('2026-11-01T00:00:00Z'),
      last_reviewed: new Date('2026-11-01T00:00:00Z'),
    })).success).toBe(true);
  });

  it('valid_to phải sau valid_from', () => {
    expect(errorFields(parse(baseFrontmatter({
      valid_from: '2026-11-02', valid_to: '2026-11-01',
    })))).toContain('valid_to');
  });
});

describe('ba ràng buộc liên-field Ch.9', () => {
  const approved = (overrides: Record<string, unknown> = {}) => baseFrontmatter({
    verification_status: 'approved',
    reviewer: 'BS. Nguyễn Văn A',
    quality_score: 90,
    quality_breakdown: {
      source_reliability: 90, technical_accuracy: 90, currency: 90,
      completeness: 90, traceability: 90, language: 90,
    },
    ...overrides,
  });

  it('approved đầy đủ ⇒ hợp lệ', () => {
    expect(parse(approved()).success).toBe(true);
  });

  it('approved thiếu reviewer ⇒ lỗi cứng', () => {
    expect(errorFields(parse(approved({ reviewer: null })))).toContain('reviewer');
  });

  it(`approved với quality_score < ${APPROVED_MIN_QUALITY_SCORE} ⇒ lỗi cứng`, () => {
    const breakdown = {
      source_reliability: 80, technical_accuracy: 80, currency: 80,
      completeness: 80, traceability: 80, language: 80,
    };
    expect(errorFields(parse(approved({ quality_score: 80, quality_breakdown: breakdown }))))
      .toContain('quality_score');
  });

  it('approved còn exclusion_flags ⇒ lỗi cứng dù điểm cao', () => {
    expect(errorFields(parse(approved({ exclusion_flags: ['unclear_source'] }))))
      .toContain('exclusion_flags');
  });

  it('in_review thì ba ràng buộc không áp', () => {
    expect(enforceChapter9({
      verification_status: 'in_review',
      reviewer: null,
      quality_score: null,
      quality_breakdown: null,
      exclusion_flags: [],
    })).toEqual([]);
  });
});

describe('7 field bổ sung của R3-M11', () => {
  it('license_status BẮT BUỘC và chỉ nhận 6 giá trị', () => {
    const missing = parse(
      Object.fromEntries(
        Object.entries(baseFrontmatter()).filter(([k]) => k !== 'license_status'),
      ),
    );
    expect(errorFields(missing)).toContain('license_status');
    expect(errorFields(parse(baseFrontmatter({ license_status: 'public' }))))
      .toContain('license_status');
    for (const value of [
      'internal_draft', 'internal_approved', 'public_domain', 'permitted', 'needs_review', 'restricted',
    ]) {
      expect(parse(baseFrontmatter({ license_status: value })).success).toBe(true);
    }
  });

  it('valid_from sai định dạng ISO ⇒ lỗi cứng', () => {
    expect(errorFields(parse(baseFrontmatter({ valid_from: '01/11/2026' }))))
      .toContain('valid_from');
    expect(parse(baseFrontmatter({ valid_from: '2026-11-01' })).success).toBe(true);
  });

  it('superseded_by phải khớp regex document_id', () => {
    expect(errorFields(parse(baseFrontmatter({ superseded_by: 'nut-1' }))))
      .toContain('superseded_by');
  });

  it('superseded_by trỏ tới document_id KHÔNG TỒN TẠI ⇒ lỗi cứng', () => {
    const docs = [
      { relPath: 'a.md', fm: { document_id: 'PIG-NUT-004', superseded_by: 'PIG-NUT-999', translation_of: null } },
    ] as unknown as Parameters<typeof checkCrossDocument>[0];
    const issues = checkCrossDocument(docs);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe('superseded_by');
    expect(issues[0].message).toContain('KHÔNG tồn tại');
  });

  it('superseded_by trỏ tới tài liệu CÓ trong kho ⇒ hợp lệ', () => {
    const docs = [
      { relPath: 'a.md', fm: { document_id: 'PIG-NUT-004', superseded_by: 'PIG-NUT-001', translation_of: null } },
      { relPath: 'b.md', fm: { document_id: 'PIG-NUT-001', superseded_by: null, translation_of: null } },
    ] as unknown as Parameters<typeof checkCrossDocument>[0];
    expect(checkCrossDocument(docs)).toEqual([]);
  });

  it('document_id trùng toàn kho ⇒ lỗi cứng', () => {
    const docs = [
      { relPath: 'a.md', fm: { document_id: 'PIG-NUT-001', superseded_by: null, translation_of: null } },
      { relPath: 'b.md', fm: { document_id: 'PIG-NUT-001', superseded_by: null, translation_of: null } },
    ] as unknown as Parameters<typeof checkCrossDocument>[0];
    expect(checkCrossDocument(docs).map((i) => i.field)).toEqual(['document_id']);
  });

  it('translated_language phải KHÁC language', () => {
    expect(errorFields(parse(baseFrontmatter({ language: 'vi', translated_language: 'vi' }))))
      .toContain('translated_language');
    expect(parse(baseFrontmatter({ language: 'vi', translated_language: 'en' })).success).toBe(true);
  });

  it('translation_of phải tồn tại trong kho', () => {
    const docs = [
      { relPath: 'a.md', fm: { document_id: 'PIG-NUT-002', superseded_by: null, translation_of: 'PIG-NUT-777' } },
    ] as unknown as Parameters<typeof checkCrossDocument>[0];
    expect(checkCrossDocument(docs).map((i) => i.field)).toEqual(['translation_of']);
  });

  it('source_bias chỉ nhận null hoặc commercial', () => {
    expect(parse(baseFrontmatter({ source_bias: 'commercial' })).success).toBe(true);
    expect(parse(baseFrontmatter({ source_bias: null })).success).toBe(true);
    expect(errorFields(parse(baseFrontmatter({ source_bias: 'academic' }))))
      .toContain('source_bias');
  });

  it('quality_breakdown BẮT BUỘC khi approved', () => {
    expect(errorFields(parse(baseFrontmatter({
      verification_status: 'approved', reviewer: 'BS. A', quality_score: 90,
    })))).toContain('quality_breakdown');
  });

  it('quality_breakdown lệch quality_score > 1 ⇒ lỗi cứng', () => {
    const breakdown = {
      source_reliability: 100, technical_accuracy: 100, currency: 100,
      completeness: 100, traceability: 100, language: 100,
    };
    expect(weightedQualityScore(breakdown)).toBe(100);
    expect(errorFields(parse(baseFrontmatter({
      verification_status: 'approved', reviewer: 'BS. A',
      quality_score: 90, quality_breakdown: breakdown,
    })))).toContain('quality_breakdown');
  });

  it('quality_breakdown lệch <= 1 ⇒ chấp nhận (làm tròn của người duyệt)', () => {
    const breakdown = {
      source_reliability: 90, technical_accuracy: 90, currency: 90,
      completeness: 90, traceability: 90, language: 90,
    };
    expect(parse(baseFrontmatter({
      verification_status: 'approved', reviewer: 'BS. A',
      quality_score: 89, quality_breakdown: breakdown,
    })).success).toBe(true);
  });

  it('tags sai hình dạng ⇒ CẢNH BÁO, không phải lỗi cứng', () => {
    const result = parse(baseFrontmatter({ tags: 'dinh dưỡng' }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const warnings = collectWarnings({ relPath: 'a.md', fm: result.data });
    expect(warnings.map((w) => w.field)).toContain('tags');
    expect(warnings.every((w) => w.level === 'warning')).toBe(true);
  });
});

describe('cảnh báo (không chặn ingest)', () => {
  it('animal_stage giá trị lạ ⇒ CẢNH BÁO, parse vẫn thành công', () => {
    const result = parse(baseFrontmatter({ animal_stage: ['heo thịt'] }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const warnings = collectWarnings({ relPath: 'a.md', fm: result.data });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('warning');
    expect(warnings[0].field).toBe('animal_stage');
    // Giá trị lạ được GIỮ trong frontmatter, không bị lọc im lặng.
    expect(result.data.animal_stage).toEqual(['heo thịt']);
  });

  it('8 giá trị enum animal_stage đều không sinh cảnh báo', () => {
    const result = parse(baseFrontmatter({ animal_stage: [...ANIMAL_STAGES] }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(collectWarnings({ relPath: 'a.md', fm: result.data })).toEqual([]);
  });

  it('software_module ở tài liệu pig_farming ⇒ cảnh báo', () => {
    const result = parse(baseFrontmatter({ software_module: 'Báo cáo' }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(collectWarnings({ relPath: 'a.md', fm: result.data }).map((w) => w.field))
      .toEqual(['software_module']);
  });
});

describe('các quy tắc còn lại của §8.1', () => {
  it('document_id sai regex ⇒ lỗi cứng', () => {
    expect(errorFields(parse(baseFrontmatter({ document_id: 'PIG-1' }))))
      .toContain('document_id');
  });

  it('thiếu document_id ⇒ lỗi cứng', () => {
    const input = baseFrontmatter();
    delete input.document_id;
    expect(errorFields(parse(input))).toContain('document_id');
  });

  it('source_url phải CÓ MẶT, nhưng được phép null', () => {
    const input = baseFrontmatter();
    delete input.source_url;
    expect(errorFields(parse(input))).toContain('source_url');
    expect(parse(baseFrontmatter({ source_url: 'https://example.org/a' })).success).toBe(true);
    expect(errorFields(parse(baseFrontmatter({ source_url: 'không-phải-url' }))))
      .toContain('source_url');
  });

  it('version phải là chuỗi — YAML đọc 1.0 thành số nên đây là lỗi thật', () => {
    expect(errorFields(parse(baseFrontmatter({ version: 1.0 })))).toContain('version');
  });

  it('thân tài liệu dưới 50 ký tự ⇒ lỗi cứng', () => {
    expect(checkBody('a.md', 'ngắn quá')).toHaveLength(1);
    expect(checkBody('a.md', 'x'.repeat(50))).toEqual([]);
  });

  it('isExpired gộp cả valid_to đã qua VÀ superseded_by (R3-M9)', () => {
    expect(isExpired({ valid_to: '2026-11-03', superseded_by: null }, FROZEN_NOW)).toBe(true);
    expect(isExpired({ valid_to: null, superseded_by: 'PIG-NUT-001' }, FROZEN_NOW)).toBe(true);
    expect(isExpired({ valid_to: '2027-01-01', superseded_by: null }, FROZEN_NOW)).toBe(false);
    expect(isExpired({ valid_to: null, superseded_by: null }, FROZEN_NOW)).toBe(false);
  });

  it('formatIssue cho đúng khuôn file:field: lý do', () => {
    expect(formatIssue({ level: 'error', file: 'a.md', field: 'domain', message: 'sai' }))
      .toBe('a.md:domain: sai');
  });
});

describe('schema của hai file JSON do ingest sinh (R3-N6)', () => {
  it('glossary.json đúng hình dạng ⇒ pass', () => {
    expect(glossaryFileSchema.safeParse({
      version: 1,
      terms: [{
        vi: 'hệ số chuyển hoá thức ăn', en: 'feed conversion ratio', abbr: 'FCR',
        unit: 'kg/kg', note: '', group: 'KPI',
        match_keys: ['he so chuyen hoa thuc an', 'feed conversion ratio', 'fcr'],
      }],
    }).success).toBe(true);
  });

  it('glossary.json thiếu match_keys ⇒ fail (đường nóng cần khoá đã chuẩn hoá sẵn)', () => {
    expect(glossaryFileSchema.safeParse({
      version: 1,
      terms: [{ vi: 'a', en: 'b', abbr: '', unit: '', note: '', group: '' }],
    }).success).toBe(false);
  });

  it('version khác 1 ⇒ fail', () => {
    expect(glossaryFileSchema.safeParse({ version: 2, terms: [] }).success).toBe(false);
  });

  it('sources.yaml đúng hình dạng ⇒ pass; thiếu license_status ⇒ fail', () => {
    const entry = {
      id: 'SRC-001', name: 'Merck Veterinary Manual', url: 'https://www.merckvetmanual.com/',
      owner: 'Merck & Co., Inc.', language: 'en', topics: ['veterinary'],
      license_status: 'needs_review', priority: 'high', notes: 'Kiểm điều khoản sử dụng.',
    };
    expect(sourcesFileSchema.safeParse({ sources: [entry] }).success).toBe(true);
    const { license_status: _omitted, ...withoutLicense } = entry;
    expect(sourcesFileSchema.safeParse({ sources: [withoutLicense] }).success).toBe(false);
  });
});

describe('Frontmatter type khớp giá trị parse được', () => {
  it('giá trị tuỳ chọn thiếu hẳn được đưa về null, không phải undefined', () => {
    const result = parse(baseFrontmatter());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const fm: Frontmatter = result.data;
    expect(fm.valid_to).toBeNull();
    expect(fm.superseded_by).toBeNull();
    expect(fm.translated_language).toBeNull();
    expect(fm.translation_of).toBeNull();
    expect(fm.source_bias).toBeNull();
    expect(fm.animal_stage).toBeNull();
    expect(fm.quality_score).toBeNull();
    expect(fm.quality_breakdown).toBeNull();
    expect(fm.exclusion_flags).toEqual([]);
  });
});
