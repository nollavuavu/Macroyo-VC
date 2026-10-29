import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fi from './locales/fi.json';
import vi from './locales/vi.json';

const NBSP = '\u00a0';
type Catalog = Record<string, string>;
const VI = vi as Catalog;
const EN = en as Catalog;
const FI = fi as Catalog;
const allVi = Object.entries(VI);

describe('Vietnamese review: glossary applied across vi.json', () => {
  it('the floor is "mức tối thiểu" everywhere, never "ngưỡng"', () => {
    expect(allVi.filter(([, v]) => /ngưỡng/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(VI['targets.kcalFloor']).toContain(`mức tối thiểu {{floor}}${NBSP}kcal`);
    expect(VI['targets.fatFloor']).toContain(`mức tối thiểu {{grams}}${NBSP}g`);
  });

  it('macros are "macro", not "chất dinh dưỡng"', () => {
    expect(allVi.filter(([, v]) => /chất dinh dưỡng/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(VI['targets.macrosBelow']).toContain('chưa được phân cho macro nào');
    expect(VI['quickAdd.mismatch']).toContain('Lượng macro này');
  });

  it('"Unspecified" sex is "Không muốn nói" and the explanatory strings say "chưa chọn giới tính"', () => {
    expect(VI['sex.unspecified']).toBe('Không muốn nói');
    expect(allVi.filter(([, v]) => /không nêu|chưa nêu/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(VI['onboarding.chooseSex']).toContain('“Không muốn nói”');
    for (const key of ['plan.formula.mifflinMale', 'plan.formula.mifflinFemale', 'plan.formula.mifflinAverage', 'sexConstant.average']) {
      expect(VI[key], key).toContain('chưa chọn giới tính');
    }
  });

  it('"duy trì" means maintenance only; sustaining a diet is "theo đuổi"', () => {
    expect(VI['targets.carbsUnder100']).toContain('khó theo đuổi lâu dài');
    expect(VI['targets.carbsUnder100']).not.toContain('duy trì');
  });

  it('copy yesterday uses "sao chép" in the button and both plural forms', () => {
    expect(VI['today.copyYesterday']).toBe('Sao chép hôm qua');
    expect(VI['today.copied_one']).toBe('Đã sao chép {{count}} món từ hôm qua.');
    expect(VI['today.copied_other']).toBe(VI['today.copied_one']);
    expect(allVi.filter(([, v]) => /\bchép\b/.test(v.replace(/sao chép/gi, ''))).map(([k]) => k)).toEqual([]);
  });

  it('calques from the review are gone', () => {
    const banned: [string, RegExp][] = [
      ['mục tiêu mềm', /mục tiêu mềm/], ['sinh ra để làm việc đó', /sinh ra để/], ['màu hổ phách', /hổ phách/],
      ['trung bình trượt', /trung bình trượt/], ['Số cân trên cân', /số cân trên cân/i], ['phần làm quen', /phần làm quen/],
      ['tay chân', /công việc tay chân/], ['Không có nó', /không có nó/i],
    ];
    for (const [label, re] of banned) {
      expect(allVi.filter(([, v]) => re.test(v)).map(([k]) => k), label).toEqual([]);
    }
  });
});

describe('Vietnamese review: the safety text', () => {
  it('deficit-unavailable is soft and says the app does not recommend it', () => {
    expect(VI['projection.deficitUnavailable']).toContain('ứng dụng không khuyến nghị thâm hụt calo');
    expect(VI['projection.deficitUnavailable']).toContain('cân nhắc');
    expect(VI['projection.deficitUnavailable']).not.toContain('không nên');
  });

  it('the disclaimer names the kind of professional and drops the "hoặc hơn" calque', () => {
    expect(VI.disclaimer).toContain('chuyên gia y tế hoặc dinh dưỡng có trình độ');
    expect(VI.disclaimer).toContain('10% trở lên');
    expect(VI.disclaimer).not.toContain('hoặc hơn');
  });

  it('plan.block.bmi is softer and matches the goal name', () => {
    expect(VI['plan.block.bmi']).toContain('giảm mỡ');
    expect(VI['plan.block.bmi']).not.toContain('nên gặp bác sĩ');
    expect(VI['plan.block.bmi']).toContain('trao đổi với bác sĩ');
  });
});

describe('Vietnamese review: Targets and Goal are told apart on Profile', () => {
  it('the Targets heading is "Mục tiêu hằng ngày" and Goal stays "Mục tiêu"', () => {
    expect(VI['profile.targets']).toBe('Mục tiêu hằng ngày');
    expect(VI['profile.targetsSaved']).toBe('Đã lưu mục tiêu hằng ngày.');
    expect(VI['common.goal']).toBe('Mục tiêu');
    expect(VI['profile.saveTargets']).toBe('Lưu mục tiêu');
  });
});

describe('Vietnamese review: missing units in all three locales', () => {
  it('projection.offsetClamped ends with a no-break-space unit after {{used}}', () => {
    expect(EN['projection.offsetClamped']).toMatch(new RegExp(`\\{\\{used\\}\\}${NBSP}kcal/day\\.$`));
    expect(VI['projection.offsetClamped']).toMatch(new RegExp(`\\{\\{used\\}\\}${NBSP}kcal/ngày\\.$`));
    expect(FI['projection.offsetClamped']).toMatch(new RegExp(`\\{\\{used\\}\\}${NBSP}kcal/pv\\.$`));
  });

  it('quickAdd.mismatch has kcal after both numbers in all three locales', () => {
    for (const catalog of [EN, VI, FI]) {
      expect(catalog['quickAdd.mismatch']).toMatch(new RegExp(`\\{\\{energy\\}\\}${NBSP}kcal`));
      expect(catalog['quickAdd.mismatch']).toMatch(new RegExp(`\\{\\{kcal\\}\\}${NBSP}kcal`));
    }
  });
});

describe('Vietnamese review: long labels were shortened', () => {
  const budget: [string, number][] = [
    ['profile.recalculate', 18], ['profile.saveKeepTargets', 18], ['storage.eraseUnreadable', 24],
    ['log.saveQuickAdd', 18], ['notFound.back', 20], ['common.next', 10], ['today.copyYesterday', 16],
  ];
  it.each(budget)('%s fits %d characters', (key, max) => {
    expect([...VI[key]].length).toBeLessThanOrEqual(max);
  });
});

describe('Vietnamese review: no-break space before units in everything it touched', () => {
  it('no plain space between a number or placeholder and kcal / g / kg', () => {
    const offenders = allVi.filter(([, v]) => /(\}\}|\d) (kcal|g|kg)(?![\wà-ỹ])/.test(v)).map(([k]) => k);
    expect(offenders).toEqual([]);
  });
});
