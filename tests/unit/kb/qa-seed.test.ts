/**
 * Chốt hai file dữ liệu của §7.2 và §18.1 bằng test, không bằng niềm tin.
 *
 * Hai điều quan trọng nhất ở đây là hai ràng buộc lấy nguyên văn từ đề án:
 * - `expected_answer` LUÔN `null` (Ch.11: không lấy câu trả lời do chatbot tạo làm đáp án
 *   chuẩn). Nếu một ngày nào đó có người "điền cho đủ", test này phải đỏ.
 * - `license_status` của cả 12 nguồn là `needs_review` (Phụ lục B: kiểm điều khoản sử dụng
 *   TRƯỚC KHI thu thập).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { sourcesFileSchema } from '@/lib/kb/schema';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const QA_SEED = path.join(REPO_ROOT, 'knowledge', '06_Test_Dataset', 'qa-seed.jsonl');
const SOURCES = path.join(REPO_ROOT, 'knowledge', '_sources', 'sources.yaml');

const GROUPS = [
  'nutrition', 'veterinary_disease', 'care_reproduction',
  'biosecurity', 'production_kpi', 'cloud_farm',
] as const;

const BEHAVIORS = [
  'answer_with_citation', 'ask_for_more_data', 'refuse_vet_safety', 'refuse_no_document',
  'flag_conflict', 'flag_outdated', 'out_of_scope',
] as const;

const HARD_CASES = [
  'conflicting_docs', 'outdated_doc', 'missing_data', 'out_of_scope',
  'veterinary_risk', 'cloud_farm_no_doc', 'cloud_farm_mixed',
] as const;

interface QaRow {
  id: string;
  group: string;
  question: string;
  expected_answer: null;
  expected_domain: string;
  expected_behavior: string;
  must_cite_document_ids: string[];
  hard_case: string | null;
  notes: string;
}

async function readRows(): Promise<QaRow[]> {
  const raw = await readFile(QA_SEED, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as QaRow);
}

describe('knowledge/06_Test_Dataset/qa-seed.jsonl (§18.1)', () => {
  it('mọi dòng là JSON hợp lệ và có đủ 9 field', async () => {
    const rows = await readRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        'expected_answer', 'expected_behavior', 'expected_domain', 'group', 'hard_case',
        'id', 'must_cite_document_ids', 'notes', 'question',
      ]);
    }
  });

  it('MỌI dòng có expected_answer === null (Ch.11)', async () => {
    const rows = await readRows();
    for (const row of rows) {
      expect(row.expected_answer, `dòng ${row.id} đã bị điền đáp án`).toBeNull();
    }
  });

  it('đủ 6 group, mỗi group 4–6 câu', async () => {
    const rows = await readRows();
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);

    expect([...counts.keys()].sort()).toEqual([...GROUPS].sort());
    for (const group of GROUPS) {
      const count = counts.get(group) ?? 0;
      expect(count, `group ${group} có ${count} câu`).toBeGreaterThanOrEqual(4);
      expect(count, `group ${group} có ${count} câu`).toBeLessThanOrEqual(6);
    }
  });

  it('đủ 7 giá trị hard_case bắt buộc, mỗi loại ít nhất một câu', async () => {
    const rows = await readRows();
    const present = new Set(rows.map((r) => r.hard_case).filter((h): h is string => h !== null));
    expect([...present].sort()).toEqual([...HARD_CASES].sort());
  });

  it('expected_behavior chỉ dùng 7 giá trị của §18.1', async () => {
    const rows = await readRows();
    for (const row of rows) {
      expect(BEHAVIORS as readonly string[]).toContain(row.expected_behavior);
    }
  });

  it('expected_domain chỉ dùng pig_farming | cloud_farm | both', async () => {
    const rows = await readRows();
    for (const row of rows) {
      expect(['pig_farming', 'cloud_farm', 'both']).toContain(row.expected_domain);
    }
  });

  it('id là duy nhất', async () => {
    const rows = await readRows();
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('must_cite_document_ids trỏ tới tài liệu CÓ THẬT trong knowledge/', async () => {
    const rows = await readRows();
    const known = new Set([
      'PIG-NUT-001', 'PIG-NUT-002', 'PIG-NUT-003', 'PIG-NUT-004', 'PIG-NUT-005',
      'PIG-KPI-001', 'PIG-KPI-002', 'PIG-KPI-003',
      'PIG-BIO-001', 'PIG-BIO-002', 'PIG-BIO-003',
      'PIG-REP-001', 'PIG-REP-002', 'PIG-REP-003',
      'PIG-GLO-001',
    ]);
    for (const row of rows) {
      for (const id of row.must_cite_document_ids) {
        expect(known.has(id), `${row.id} dẫn tới ${id} không có trong kho`).toBe(true);
      }
    }
  });

  it('ca conflicting_docs dùng đúng cặp PIG-NUT-001 + PIG-NUT-005', async () => {
    const rows = await readRows();
    const row = rows.find((r) => r.hard_case === 'conflicting_docs');
    expect(row).toBeDefined();
    expect(row?.must_cite_document_ids.sort()).toEqual(['PIG-NUT-001', 'PIG-NUT-005']);
    expect(row?.expected_behavior).toBe('flag_conflict');
  });

  it('có một câu out_of_scope thật rõ (R3-M10)', async () => {
    const rows = await readRows();
    const row = rows.find((r) => r.hard_case === 'out_of_scope');
    expect(row?.question).toContain('cổ phiếu');
    expect(row?.expected_behavior).toBe('out_of_scope');
  });

  it('mọi câu cloud_farm đều KHÔNG kỳ vọng trạng thái trả lời được', async () => {
    // Kho CF rỗng có chủ đích, nên không câu nào trong nhóm này được phép kỳ vọng
    // answer_with_citation — nếu có, bộ test đang mong hệ thống bịa ra nội dung CF.
    const rows = await readRows();
    for (const row of rows.filter((r) => r.group === 'cloud_farm')) {
      expect(row.expected_behavior).not.toBe('answer_with_citation');
    }
  });
});

describe('knowledge/_sources/sources.yaml (§7.2)', () => {
  it('có đúng 12 mục và đều hợp lệ theo schema', async () => {
    const parsed = sourcesFileSchema.safeParse(yaml.load(await readFile(SOURCES, 'utf8')));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sources).toHaveLength(12);
  });

  it('12/12 mục có license_status === needs_review', async () => {
    const parsed = sourcesFileSchema.parse(yaml.load(await readFile(SOURCES, 'utf8')));
    const needsReview = parsed.sources.filter((s) => s.license_status === 'needs_review');
    expect(needsReview).toHaveLength(12);
  });

  it('id duy nhất và URL đúng của Phụ lục B', async () => {
    const parsed = sourcesFileSchema.parse(yaml.load(await readFile(SOURCES, 'utf8')));
    expect(new Set(parsed.sources.map((s) => s.id)).size).toBe(12);

    const urls = parsed.sources.map((s) => s.url);
    for (const required of [
      'https://www.merckvetmanual.com/',
      'https://www.merckvetmanual.com/management-and-nutrition/nutrition-pigs/feeding-levels-and-practices-in-pigs',
      'https://www.merckvetmanual.com/management-and-nutrition/preventive-health-care-and-husbandry-of-pigs/preventive-health-care-and-husbandry-of-pigs',
      'https://www.pic.com/resources/',
      'https://www.pic.com/resources/pic-nutrition-and-feeding-guidelines-metric/',
      'https://www.asi.k-state.edu/extension/swine/swinenutritionguide/index.html',
      'https://www.woah.org/en/disease/african-swine-fever/',
      'https://www.woah.org/en/disease/classical-swine-fever/',
      'https://www.fao.org/',
      'https://vanban.chinhphu.vn/',
      'https://vbpl.moj.gov.vn/',
      'https://faolex.fao.org/',
    ]) {
      expect(urls, `thiếu nguồn ${required}`).toContain(required);
    }
  });

  it('là DANH MỤC metadata: không mục nào mang nội dung dài kiểu bài viết', async () => {
    // Phụ lục B cấm copy nội dung. `notes` là ghi chú pháp lý/vận hành, nên nó phải ngắn;
    // một `notes` dài hàng nghìn ký tự là dấu hiệu nội dung nguồn đã bị dán vào đây.
    const parsed = sourcesFileSchema.parse(yaml.load(await readFile(SOURCES, 'utf8')));
    for (const source of parsed.sources) {
      expect(source.notes.length, `notes của ${source.id} quá dài`).toBeLessThan(400);
    }
  });
});
