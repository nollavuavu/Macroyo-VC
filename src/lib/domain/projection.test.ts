import { describe, expect, it } from 'vitest';
import vectors from './proj_test_vectors.json';
import {
  DEFAULT_HORIZONS,
  bmrMifflin,
  maxSafeOffset,
  projectStatic,
  projectV1,
  projectWeeklyMifflin,
  roundHalfUp1,
} from './projection';

interface VectorCase {
  name: string;
  description: string;
  input: {
    weight_kg: number;
    height_cm: number;
    age: number;
    sex: 'male' | 'female';
    activity_factor: number;
    daily_offset_kcal: number;
    apply_guardrails?: boolean;
    tdee_override_kcal?: number;
    horizons_days?: number[];
    floor_kcal?: number;
  };
  expected: {
    bmr_kcal: number;
    tdee_kcal: number;
    effective_offset_kcal: number;
    target_kcal: number;
    max_safe_offset_kcal: number;
    min_weight_kg: number;
    pct_bw_per_week: number;
    deficit_unavailable: boolean;
    warning_codes: string[];
    horizons: {
      horizon_days: number;
      model: string;
      delta_kg: number;
      delta_lb: number;
      final_weight_kg: number;
      clamped: boolean;
      delta_kg_r: number;
      delta_lb_r: number;
    }[];
  };
}

const doc = vectors as { cases: VectorCase[] };

function close(actual: number, expected: number, tol = 1e-9): boolean {
  return Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
}

describe('project_v1 golden vectors', () => {
  it('loads all 15 cases', () => {
    expect(doc.cases).toHaveLength(15);
  });

  for (const vectorCase of doc.cases) {
    it(vectorCase.name, () => {
      const result = projectV1(vectorCase.input);
      const expected = vectorCase.expected;
      expect(close(result.bmr_kcal, expected.bmr_kcal)).toBe(true);
      expect(close(result.tdee_kcal, expected.tdee_kcal)).toBe(true);
      expect(close(result.effective_offset_kcal, expected.effective_offset_kcal)).toBe(true);
      expect(close(result.target_kcal, expected.target_kcal)).toBe(true);
      expect(close(result.max_safe_offset_kcal, expected.max_safe_offset_kcal)).toBe(true);
      expect(close(result.min_weight_kg, expected.min_weight_kg)).toBe(true);
      expect(close(result.pct_bw_per_week, expected.pct_bw_per_week)).toBe(true);
      expect(result.deficit_unavailable).toBe(expected.deficit_unavailable);
      expect(result.warnings.map((warning) => warning.code)).toEqual(expected.warning_codes);
      expect(result.horizons).toHaveLength(expected.horizons.length);
      result.horizons.forEach((row, index) => {
        const want = expected.horizons[index];
        expect(row.model).toBe(want.model);
        expect(row.clamped).toBe(want.clamped);
        expect(close(row.horizon_days, want.horizon_days)).toBe(true);
        expect(close(row.delta_kg, want.delta_kg), `${want.horizon_days} delta_kg`).toBe(true);
        expect(close(row.delta_lb, want.delta_lb), `${want.horizon_days} delta_lb`).toBe(true);
        expect(close(row.final_weight_kg, want.final_weight_kg)).toBe(true);
        expect(close(row.delta_kg_r, want.delta_kg_r)).toBe(true);
        expect(close(row.delta_lb_r, want.delta_lb_r)).toBe(true);
      });
    });
  }
});

describe('proj.py selftest boundary cases', () => {
  const weekly = (horizons: number[], offset = -500) =>
    projectWeeklyMifflin(80, 180, 30, 'male', 1.55, offset, horizons);

  it('static -500 x 91.3 d = -45650/7700 kg', () => {
    expect(close(projectStatic(80, -500, [91.3])[0].delta_kg, -45650 / 7700)).toBe(true);
  });

  it('lb = kg * 2.20462 in both models', () => {
    const rows = [...projectStatic(80, -500), ...weekly([...DEFAULT_HORIZONS])];
    for (const row of rows) expect(close(row.delta_lb, row.delta_kg * 2.20462)).toBe(true);
  });

  it('static -500 x 91.3 d lb is about -13.0702 and not the 3500 path', () => {
    expect(Math.abs(projectStatic(80, -500, [91.3])[0].delta_lb + 13.07022) < 1e-4).toBe(true);
  });

  it('week-1 weekly Mifflin equals the static week', () => {
    expect(close(weekly([7])[0].delta_kg, -3500 / 7700)).toBe(true);
  });

  it('week-2 hand value is 79.09731404958 kg', () => {
    expect(Math.abs(weekly([14])[0].final_weight_kg - 79.09731404958) < 1e-9).toBe(true);
  });

  it('horizon independence: weight at day 14 does not depend on the other horizons', () => {
    const alone = weekly([14])[0].final_weight_kg;
    const among = weekly([7, 30.44, 14, 91.3])[2].final_weight_kg;
    expect(close(alone, among)).toBe(true);
  });

  it('linear pro-rating: weight(10.5) is the mean of day 7 and day 14', () => {
    const mid = weekly([10.5])[0].final_weight_kg;
    const mean = (weekly([7])[0].final_weight_kg + weekly([14])[0].final_weight_kg) / 2;
    expect(close(mid, mean)).toBe(true);
  });

  it('published 80 kg -500 weekly deltas round to 5.5 / 10.0 / 16.9', () => {
    const rounded = weekly([91.3, 182.6, 365.25]).map((row) => roundHalfUp1(row.delta_kg));
    expect(rounded).toEqual([-5.5, -10.0, -16.9]);
  });

  it('max safe offset for the 80 kg man is 689.75', () => {
    expect(close(maxSafeOffset(80, 180, 2759, 1780, 'male'), 689.75)).toBe(true);
  });

  it('static BMI clamp: 60.5 kg at -2000 for 1 week ends at 59.94 kg', () => {
    expect(close(projectStatic(60.5, -2000, [7], 180)[0].final_weight_kg, 59.94)).toBe(true);
  });

  it('surplus warning boundary: 413 kcal does not warn, 414 does (15% of 2759)', () => {
    const codes = (offset: number) =>
      projectV1({
        weight_kg: 80,
        height_cm: 180,
        age: 30,
        sex: 'male',
        activity_factor: 1.55,
        daily_offset_kcal: offset,
      }).warnings.map((warning) => warning.code);
    expect(codes(413)).not.toContain('SURPLUS_MOSTLY_FAT');
    expect(codes(414)).toContain('SURPLUS_MOSTLY_FAT');
  });

  it('surplus +500 absolute boundary at TDEE 4000: 500 no, 501 yes', () => {
    const codes = (offset: number) =>
      projectV1({
        weight_kg: 80,
        height_cm: 180,
        age: 30,
        sex: 'male',
        activity_factor: 1.55,
        daily_offset_kcal: offset,
        tdee_override_kcal: 4000,
      }).warnings.map((warning) => warning.code);
    expect(codes(500)).not.toContain('SURPLUS_MOSTLY_FAT');
    expect(codes(501)).toContain('SURPLUS_MOSTLY_FAT');
  });

  it('deficit_unavailable threshold: cap 100 is false, 99.9 is true', () => {
    const base = {
      weight_kg: 50,
      height_cm: 155,
      age: 55,
      sex: 'female' as const,
      activity_factor: 1.2,
      daily_offset_kcal: -50,
    };
    expect(projectV1({ ...base, tdee_override_kcal: 1300 }).deficit_unavailable).toBe(false);
    expect(projectV1({ ...base, tdee_override_kcal: 1299.9 }).deficit_unavailable).toBe(true);
  });

  it('deficit_unavailable with a requested deficit projects maintenance and no OFFSET_CLAMPED', () => {
    const result = projectV1({
      weight_kg: 55,
      height_cm: 160,
      age: 60,
      sex: 'male',
      activity_factor: 1.2,
      daily_offset_kcal: -250,
    });
    expect(result.effective_offset_kcal).toBe(0);
    expect(result.target_kcal).toBe(result.tdee_kcal);
    expect(result.warnings.map((warning) => warning.code)).toEqual(['DEFICIT_UNAVAILABLE']);
    expect(result.horizons.every((row) => row.delta_kg === 0)).toBe(true);
  });

  it('55 kg, 160 cm, 60 y, PAL 1.2 has a cap of exactly 6', () => {
    const result = projectV1({
      weight_kg: 55,
      height_cm: 160,
      age: 60,
      sex: 'male',
      activity_factor: 1.2,
      daily_offset_kcal: -250,
    });
    expect(close(result.max_safe_offset_kcal, 6)).toBe(true);
    expect(close(result.bmr_kcal, 1255)).toBe(true);
    expect(close(result.tdee_kcal, 1506)).toBe(true);
  });

  it('guardrails off still reports deficit_unavailable but projects the deficit', () => {
    const result = projectV1({
      weight_kg: 55,
      height_cm: 160,
      age: 60,
      sex: 'male',
      activity_factor: 1.2,
      daily_offset_kcal: -250,
      apply_guardrails: false,
    });
    expect(result.deficit_unavailable).toBe(true);
    expect(result.effective_offset_kcal).toBe(-250);
    const codes = result.warnings.map((warning) => warning.code);
    expect(codes).not.toContain('DEFICIT_UNAVAILABLE');
    expect(codes).not.toContain('OFFSET_CLAMPED');
  });

  it('a cap of 100 clamps a larger deficit with OFFSET_CLAMPED only', () => {
    const result = projectV1({
      weight_kg: 50,
      height_cm: 155,
      age: 55,
      sex: 'female',
      activity_factor: 1.2,
      daily_offset_kcal: -250,
      tdee_override_kcal: 1300,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(['OFFSET_CLAMPED']);
    expect(close(result.effective_offset_kcal, -100)).toBe(true);
  });

  it('roundHalfUp1 matches half-up on negatives: 0.25, -0.25, -0.04', () => {
    expect(roundHalfUp1(0.25)).toBe(0.3);
    expect(roundHalfUp1(-0.25)).toBe(-0.3);
    expect(roundHalfUp1(-0.04)).toBe(0);
  });

  it('sanity: 80 kg man at -500 is -0.5, -2.0, -5.5, -10.0, -16.9 kg', () => {
    const result = projectV1({
      weight_kg: 80,
      height_cm: 180,
      age: 30,
      sex: 'male',
      activity_factor: 1.55,
      daily_offset_kcal: -500,
    });
    expect(result.horizons.map((row) => row.delta_kg_r)).toEqual([-0.5, -2.0, -5.5, -10.0, -16.9]);
    expect(bmrMifflin(80, 180, 30, 'male')).toBe(1780);
  });
});
