import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCustomOffset, inLegacyStoredRange, interpretFfmi, showMaleReferenceNote } from './domain';
import { previewPortion } from './logging';
import { BODY_STAT, LOG, PROFILE } from './testFixtures';
import { STORED_MAX_GRAMS, STORED_MAX_KCAL, parseStoredData, validateStoredData } from './storage/shape';
import { screenBottomPadding, snackbarGeometry } from '../theme/extras';
import { getTheme, motion } from '../theme/theme';
import enCatalog from '../i18n/locales/en.json';
import vi from '../i18n/locales/vi.json';
import fi from '../i18n/locales/fi.json';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const theme = getTheme('light');

describe('UI-R4-1: the undo notice is a floating snackbar above the tab bar', () => {
  it('geometry: anchored with the theme margin above the bar, and the list scrolls clear of it', () => {
    const geometry = snackbarGeometry(theme, { insetBottom: 34, belowTabBar: true });
    expect(geometry.bottom).toBe(theme.spacing.lg); // the navigator already keeps the bar and inset out of the way
    expect(geometry.contentPaddingBottom).toBeGreaterThanOrEqual(geometry.bottom + geometry.height + theme.spacing.lg);
    // a screen on the device edge adds the safe-area inset itself
    expect(snackbarGeometry(theme, { insetBottom: 34, belowTabBar: false }).bottom).toBe(theme.spacing.lg + 34);
  });
  it('the content padding is raised to the snackbar clearance, never lowered', () => {
    const options = { insetBottom: 0, belowTabBar: true, fabClearance: false };
    const normal = screenBottomPadding(theme, options);
    expect(screenBottomPadding(theme, { ...options, minimum: 0 })).toBe(normal);
    expect(screenBottomPadding(theme, { ...options, minimum: snackbarGeometry(theme, { insetBottom: 0, belowTabBar: true }).contentPaddingBottom }))
      .toBeGreaterThan(normal - 1);
    expect(screenBottomPadding(theme, { ...options, minimum: 1 })).toBe(normal);
  });
  it('auto-dismiss is 5-6 s', () => {
    expect(motion.toast).toBeGreaterThanOrEqual(5000);
    expect(motion.toast).toBeLessThanOrEqual(6000);
  });
  it('Log renders the Snackbar outside the scrolling list, pauses the timer on press/focus and clears it on unmount', () => {
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/<\/Screen>\s*\{undo \? \(\s*<Snackbar/);
    expect(log).not.toMatch(/\{undo \? \(\s*<Card>/);
    expect(log).toMatch(/onHold=\{\(\) => setUndoHeld\(true\)\}/);
    expect(log).toMatch(/onRelease=\{\(\) => setUndoHeld\(false\)\}/);
    expect(log).toMatch(/if \(undoHeld\) return;\s*const timer = setTimeout\(\(\) => setUndo\(null\), motion\.toast\);\s*return \(\) => clearTimeout\(timer\)/);
    expect(log).toMatch(/bottomClearance=\{undo \? snackbarGeometry/);
  });
  it('the Snackbar is a polite live-region status, positioned from the safe area and theme tokens', () => {
    const ui = read('src/components/ui.tsx');
    const block = ui.slice(ui.indexOf('export function Snackbar'), ui.indexOf('export function StorageProblem'));
    expect(block).toMatch(/role="status"/);
    expect(block).toMatch(/accessibilityLiveRegion="polite"/);
    expect(block).toMatch(/useSafeAreaInsets\(\)/);
    expect(block).toMatch(/snackbarGeometry\(theme, \{ insetBottom: insets\.bottom, belowTabBar \}\)/);
    expect(block).toMatch(/position: 'absolute'/);
    expect(block).toMatch(/onHold=\{onHold\} onRelease=\{onRelease\}/);
    const button = ui.slice(ui.indexOf('export function SecondaryButton'), ui.indexOf('export function Chip'));
    for (const handler of ['onPressIn={onHold}', 'onPressOut={onRelease}', 'onFocus={onHold}', 'onBlur={onRelease}']) expect(button).toContain(handler);
  });
});

describe('UI-R4-2: "80." is accepted in the custom kcal field', () => {
  it('a trailing dot or comma parses like the other numeric fields', () => {
    for (const text of ['80.', '80,']) {
      expect(parseCustomOffset(text, 'deficit')).toMatchObject({ valid: true, offset: -80, magnitude: 80 });
      expect(parseCustomOffset(text, 'surplus')).toMatchObject({ valid: true, offset: 80 });
    }
    expect(parseCustomOffset('-80.', 'surplus')).toMatchObject({ valid: true, offset: -80 });
    expect(parseCustomOffset('+80.', 'deficit')).toMatchObject({ valid: true, offset: 80 });
    expect(parseCustomOffset('.5', 'deficit')).toMatchObject({ valid: true, offset: -0.5 });
  });
  it('still rejects what it rejected before', () => {
    for (const text of ['--300', '-', '.', '80..', '8 0.0.', 'abc', '80.5.']) expect(parseCustomOffset(text, 'surplus').valid, text).toBe(false);
    expect(parseCustomOffset('1,234', 'surplus').valid).toBe(false);
    expect(parseCustomOffset('80.5', 'surplus').offset).toBe(80.5);
  });
  it('uses the shared parser for the magnitude', () => {
    expect(read('src/lib/domain/offset.ts')).toMatch(/parseDecimal\(body\)/);
  });
});

describe('UI-R4-3: the custom kcal field does not ask for a minus key', () => {
  it('Age is an integer field: number-pad on iOS, numeric inputMode on the web', () => {
    for (const path of ['app/onboarding.tsx', 'app/(tabs)/profile.tsx', 'app/(tabs)/calc.tsx']) {
      expect(read(path), path).toMatch(/label=\{t\('common\.age'\)\}[^\n]*|common\.age/);
    }
    expect(read('app/(tabs)/calc.tsx')).toMatch(/suffix=\{t\('unit\.years'\)\} keyboard="number"/);
    expect(read('app/(tabs)/profile.tsx')).toMatch(/common\.age'\)[^\n]*keyboard="number"/);
    expect(read('app/onboarding.tsx')).toMatch(/common\.age'\)[^\n]*keyboard="number"/);
    const ui = read('src/components/ui.tsx');
    expect(ui).toMatch(/keyboard === 'number' \? 'number-pad' : 'decimal-pad'/);
    expect(ui).toMatch(/keyboard === 'number' \? 'numeric' : 'decimal'/);
  });
  it('placeholder, error and hint point at Deficit/Surplus, never at typing "-300"', () => {
    for (const [name, locale] of [['en', enCatalog], ['vi', vi], ['fi', fi]] as const) {
      const catalog = locale as Record<string, string>;
      expect(catalog['calc.customPlaceholder'], name).not.toMatch(/-300|−300/);
      expect(catalog['offset.invalid'], name).not.toMatch(/-300|−300/);
      expect(catalog['offset.invalid'], name).toContain(catalog['calc.deficit']);
      expect(catalog['offset.invalid'], name).toContain(catalog['calc.surplus']);
      expect(catalog['calc.customHint'], name).toContain(catalog['calc.deficit']);
      expect(catalog['calc.customHint'], name).toContain(catalog['calc.surplus']);
    }
    expect(read('app/(tabs)/calc.tsx')).toMatch(/t\('calc\.customHint'\)/);
  });
});

describe('UI-R4-4: no "male reference data" note under a result that is not banded', () => {
  it('hidden for every non-banded result (see polish6 for the male case)', () => {
    for (const sex of ['female', 'unspecified'] as const) {
      const reading = interpretFfmi(sex, 17.4);
      expect(reading.banded).toBe(false);
      expect(showMaleReferenceNote(sex, reading)).toBe(false);
    }
    expect(showMaleReferenceNote('male', interpretFfmi('male', 21))).toBe(true); // corrected in polish 6 (see polish6.test.ts)
    expect(read('app/(tabs)/calc.tsx')).toMatch(/showMaleReferenceNote\(sex, ffmiReading\)/);
    expect(read('app/(tabs)/calc.tsx')).not.toMatch(/sex !== 'male' \? \(/);
  });
});

describe('UI-R4-5: the portion preview', () => {
  const rice = { kcal: 97, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 1.7 };
  it('shows nothing for grams the Add button refuses', () => {
    for (const grams of [-5, 0, 5001, null, Number.NaN]) expect(previewPortion(rice, grams as number | null), String(grams)).toBeNull();
    expect(previewPortion(rice, 150)).not.toBeNull();
    expect(previewPortion(rice, 5000)).not.toBeNull();
  });
  it('kcal in the preview is the same whole number as the saved row', () => {
    const banana = { kcal: 97, protein: 1, carbs: 23, fat: 0.3, fiber: 2 };
    expect(previewPortion(banana, 50)!.kcal).toBe(48.5); // the exact value is kept for saving ...
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/formatKcal\(displayKcal\(preview\.kcal\)\)/); // ... and shown rounded, like the row (49)
    expect(log).toMatch(/const preview = selected\s*\? previewPortion\(/);
  });
});

describe('BUG-QA-17: stored profiles with impossible numbers are read failures', () => {
  const profile = (extra: Record<string, unknown>, targets: Record<string, unknown> = {}) => ({ ...PROFILE, ...extra, targets: { ...PROFILE.targets, ...targets } });
  const load = (data: unknown) => parseStoredData(JSON.stringify(data));
  it('accepts what the app writes', () => {
    expect(() => load({ profile: profile({}), logs: [LOG], bodyStats: [BODY_STAT] })).not.toThrow();
    // old wide-range values load too: they are kept until the user changes them
    expect(() => load({ profile: profile({ heightCm: 245, weightKg: 290 }) })).not.toThrow();
  });
  it.each([0, -5, -0.0001])('rejects height %s', (heightCm) => {
    expect(() => validateStoredData({ profile: profile({ heightCm }) })).toThrow(/heightCm/);
  });
  it.each([0, -1, -0.0001])('rejects weight %s', (weightKg) => {
    expect(() => validateStoredData({ profile: profile({ weightKg }) })).toThrow(/weightKg/);
  });
  it('rejects non-finite height and weight (stored as null by JSON)', () => {
    for (const field of ['heightCm', 'weightKg']) {
      expect(() => load({ profile: profile({ [field]: null }) })).toThrow();
      expect(() => validateStoredData({ profile: profile({ [field]: Infinity }) })).toThrow();
      expect(() => validateStoredData({ profile: profile({ [field]: Number.NaN }) })).toThrow();
    }
  });
  it('rejects negative and huge targets', () => {
    for (const field of ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG']) {
      // carbs -1 is the one exception: legacy data, clamped to 0 on load (BUG-QA-18, polish6.test.ts)
      if (field !== 'carbsG') expect(() => validateStoredData({ profile: profile({}, { [field]: -1 }) }), `${field} -1`).toThrow(/targets/);
      expect(() => validateStoredData({ profile: profile({}, { [field]: 1e9 }) }), `${field} 1e9`).toThrow(/targets/);
    }
    expect(() => validateStoredData({ profile: profile({}, { kcal: STORED_MAX_KCAL }) })).not.toThrow();
    expect(() => validateStoredData({ profile: profile({}, { kcal: STORED_MAX_KCAL + 1 }) })).toThrow();
    expect(() => validateStoredData({ profile: profile({}, { proteinG: STORED_MAX_GRAMS + 1 }) })).toThrow();
    expect(() => validateStoredData({ profile: profile({}, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }) })).not.toThrow();
  });
  it('rejects negative or huge kcal and grams in logs, and impossible body stats', () => {
    for (const field of ['kcal', 'grams', 'proteinG', 'carbsG', 'fatG', 'fiberG']) {
      expect(() => validateStoredData({ logs: [{ ...LOG, [field]: -1 }] }), `${field} -1`).toThrow(/logs\[0\]/);
      expect(() => validateStoredData({ logs: [{ ...LOG, [field]: 1e9 }] }), `${field} 1e9`).toThrow(/logs\[0\]/);
    }
    expect(() => validateStoredData({ logs: [{ ...LOG, kcal: 0, grams: 0 }] })).not.toThrow();
    for (const field of ['weightKg', 'heightCm']) {
      expect(() => validateStoredData({ bodyStats: [{ ...BODY_STAT, [field]: 0 }] })).toThrow(/bodyStats\[0\]/);
    }
  });
  it('rejects impossible dates such as 0000-00-00 and 2026-02-31', () => {
    for (const date of ['0000-00-00', '2026-13-01', '2026-02-31', '2026-00-10']) {
      expect(() => validateStoredData({ logs: [{ ...LOG, date }] }), date).toThrow(/date/);
    }
    expect(() => validateStoredData({ logs: [{ ...LOG, date: '2028-02-29' }] })).not.toThrow();
  });
  it('a failed check is a read failure in the store: the blob is backed up and writes stay blocked', () => {
    for (const path of ['src/lib/storage/persistImpl.ts', 'src/lib/storage/persistImpl.web.ts']) expect(read(path), path).toMatch(/return parseStoredData\(/); // a throw there is the read failure the store already handles
  });
  it('the Profile unchanged-value exemption only covers the old wide ranges', () => {
    expect(inLegacyStoredRange('height', 100)).toBe(true);
    expect(inLegacyStoredRange('height', 250)).toBe(true);
    expect(inLegacyStoredRange('weight', 30)).toBe(true);
    expect(inLegacyStoredRange('weight', 300)).toBe(true);
    for (const value of [0, -5, 99.9, 250.1, 1e9, Number.NaN]) expect(inLegacyStoredRange('height', value), `h ${value}`).toBe(false);
    for (const value of [0, -1, 29.9, 300.1, 1e9, Number.POSITIVE_INFINITY]) expect(inLegacyStoredRange('weight', value), `w ${value}`).toBe(false);
    const profileScreen = read('app/(tabs)/profile.tsx');
    expect(profileScreen).toMatch(/value === profile\.heightCm && inLegacyStoredRange\('height', value\)/);
    expect(profileScreen).toMatch(/value === profile\.weightKg && inLegacyStoredRange\('weight', value\)/);
  });
});

describe('fi imperial units label', () => {
  it('is "Jalat ja paunat" (feet and pounds), not "Brittiläinen" (British)', () => {
    expect(fi['units.imperial']).toBe('Jalat ja paunat');
    expect(JSON.stringify(fi)).not.toMatch(/Brittil/);
  });
});
