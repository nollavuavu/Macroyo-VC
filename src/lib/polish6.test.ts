import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fatFloorGrams, interpretFfmi, showMaleReferenceNote } from './domain';
import { BODY_STAT, LOG, PROFILE } from './testFixtures';
import { STORED_MAX_GRAMS, parseStoredData, validateStoredData } from './storage/shape';
import enCatalog from '../i18n/locales/en.json';
import vi from '../i18n/locales/vi.json';
import fi from '../i18n/locales/fi.json';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const profile = (targets: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ ...PROFILE, ...extra, targets: { ...PROFILE.targets, ...targets } });

describe('BUG-QA-18: a legacy negative carbs target loads, clamped to 0', () => {
  it.each([-1, -30, -269, -0.5])('carbsG %s loads as 0 and the rest of the profile is untouched', (carbsG) => {
    const input = { profile: profile({ carbsG }, { goal: 'cut', weightKg: 163.2 }), logs: [LOG], bodyStats: [BODY_STAT] };
    const loaded = parseStoredData(JSON.stringify(input));
    expect(loaded.profile?.targets.carbsG).toBe(0);
    expect(loaded.profile?.targets).toEqual({ ...PROFILE.targets, carbsG: 0 });
    expect(loaded.profile?.weightKg).toBe(163.2);
    expect(loaded.logs).toHaveLength(1);
  });
  it('does not change the object it was given, and leaves valid carbs alone', () => {
    const input = { profile: profile({ carbsG: -30 }) };
    validateStoredData(input);
    expect(input.profile.targets.carbsG).toBe(-30);
    expect(validateStoredData({ profile: profile({ carbsG: 0 }) }).profile?.targets.carbsG).toBe(0);
    expect(validateStoredData({ profile: profile({ carbsG: 220 }) }).profile?.targets.carbsG).toBe(220);
  });
  it('only carbs, and only a plausible negative: everything else is still a read failure', () => {
    for (const field of ['kcal', 'proteinG', 'fatG', 'fiberG']) {
      expect(() => validateStoredData({ profile: profile({ [field]: -1 }) }), field).toThrow(/targets/);
    }
    expect(() => validateStoredData({ profile: profile({ carbsG: -STORED_MAX_GRAMS - 1 }) })).toThrow(/carbsG/);
    expect(() => validateStoredData({ profile: profile({ carbsG: -1e9 }) })).toThrow(/carbsG/);
    expect(() => validateStoredData({ profile: profile({ carbsG: 1e9 }) })).toThrow(/carbsG/);
    expect(() => validateStoredData({ profile: profile({ carbsG: null }) })).toThrow(/carbsG/);
    expect(() => validateStoredData({ profile: profile({ carbsG: '-30' }) })).toThrow(/carbsG/);
    expect(() => validateStoredData({ profile: profile({ carbsG: -30 }, { heightCm: 0 }) })).toThrow(/heightCm/); // other checks still run
    expect(() => validateStoredData({ logs: [{ ...LOG, carbsG: -1 }] })).toThrow(/logs\[0\]/); // log entries are not legacy-clamped
  });
});

describe('Erase asks for a real confirm step everywhere', () => {
  const ui = read('src/components/ui.tsx');
  const confirm = ui.slice(ui.indexOf('export function ConfirmErase'), ui.indexOf('export function Snackbar'));
  it('ConfirmErase: warning, a destructive-styled confirm, Cancel, announced as an alert', () => {
    expect(confirm).toMatch(/<WarningLine>\{warning\}<\/WarningLine>/);
    expect(confirm).toMatch(/label=\{confirmLabel\} onPress=\{onConfirm\}[^\n]*tone="destructive"/);
    expect(confirm).toMatch(/label=\{t\('common\.cancel'\)\} onPress=\{onCancel\}/);
    expect(confirm).toMatch(/role="alert"/);
    expect(confirm).not.toMatch(/PrimaryButton/);
    expect(confirm).not.toMatch(/Alert\.alert/); // an inline card works the same on web and native
  });
  it('Profile: Reset data only opens the confirm; the erase runs from the confirm button', () => {
    const profileScreen = read('app/(tabs)/profile.tsx');
    expect(profileScreen).toMatch(/label=\{t\('profile\.resetData'\)\} onPress=\{\(\) => setConfirmReset\(true\)\}/);
    expect(profileScreen).toMatch(/<ConfirmErase[\s\S]*?confirmTestID="erase-everything"[\s\S]*?onConfirm=\{\(\) => \{ void eraseThenLeave\(resetAll[\s\S]*?onCancel=\{\(\) => setConfirmReset\(false\)\}/);
    expect(profileScreen.match(/resetAll/g)!.filter(Boolean).length).toBeGreaterThan(0);
    expect(profileScreen).not.toMatch(/label=\{t\('profile\.resetData'\)\} onPress=\{[^}]*resetAll/);
  });
  it('Storage card: the first press only asks; resetAll is only called from the confirm', () => {
    const banner = ui.slice(ui.indexOf('export function StorageBanner'), ui.indexOf('export function ConfirmErase'));
    expect(banner).toMatch(/testID="reset-unreadable" tone="destructive"/);
    expect(banner).toMatch(/onPress=\{\(\) => setConfirming\(true\)\} testID="reset-unreadable"/);
    expect(banner).toMatch(/<ConfirmErase[\s\S]*?onConfirm=\{\(\) => \{ void resetAll\(\); \}\}[\s\S]*?onCancel=\{\(\) => setConfirming\(false\)\}/);
    expect(banner.match(/resetAll\(\)/g)).toHaveLength(1);
  });
  it('StorageProblem uses the same confirm', () => {
    const problem = ui.slice(ui.indexOf('export function StorageProblem'), ui.indexOf('export function WarningNotice'));
    expect(problem).toMatch(/<ConfirmErase[\s\S]*?confirmTestID="storage-problem-erase-confirm"[\s\S]*?storage\.eraseConfirm/);
    expect(problem.match(/resetAll\(\)/g)).toHaveLength(1);
    expect(problem).not.toMatch(/PrimaryButton/);
  });
  it('no other erase path calls resetAll straight from a button', () => {
    for (const path of ['app/(tabs)/profile.tsx', 'app/onboarding.tsx', 'src/components/ui.tsx']) {
      for (const line of read(path).split('\n')) {
        if (/resetAll/.test(line) && /onPress=/.test(line)) expect(line, path).toMatch(/onConfirm=|erase-everything/);
      }
    }
  });
  it('strings exist in en, vi and fi; the warnings say it cannot be undone; the vi confirm is short and polite', () => {
    for (const [name, locale] of [['en', enCatalog], ['vi', vi], ['fi', fi]] as const) {
      const catalog = locale as Record<string, string>;
      for (const key of ['storage.eraseConfirm', 'storage.eraseConfirmButton', 'profile.eraseWarning']) expect(catalog[key], `${name} ${key}`).toBeTruthy();
      expect(catalog['storage.eraseConfirmButton']).not.toBe(catalog['storage.eraseUnreadable']);
    }
    expect(enCatalog['storage.eraseConfirm']).toMatch(/cannot be undone/);
    expect(enCatalog['profile.eraseWarning']).toMatch(/cannot be undone/);
    expect(vi['storage.eraseConfirm']).toMatch(/không thể hoàn tác/);
    expect(vi['profile.eraseWarning']).toMatch(/không thể hoàn tác/);
    expect(vi['storage.eraseConfirmButton']).toBe('Xóa và làm lại'); // vi-review.md: short "Xóa và làm lại", modern spelling, no pronoun
    expect(fi['profile.eraseWarning']).toMatch(/ei voi perua/);
  });
});

describe('showMaleReferenceNote: shown for a banded male reading, hidden otherwise', () => {
  it('male + banded: shown, at every band', () => {
    for (const value of [15, 17.9, 18, 19.9, 21, 22.5, 24, 27]) {
      const reading = interpretFfmi('male', value);
      expect(reading.banded).toBe(true);
      expect(showMaleReferenceNote('male', reading), String(value)).toBe(true);
    }
  });
  it('female and unspecified are not banded, so the note is hidden (they see the "not validated" text)', () => {
    for (const sex of ['female', 'unspecified'] as const) {
      const reading = interpretFfmi(sex, 19);
      expect(reading.banded).toBe(false);
      expect(showMaleReferenceNote(sex, reading)).toBe(false);
    }
  });
  it('a banded reading is never combined with a non-male sex', () => {
    expect(showMaleReferenceNote('female', { band: 'Average', label: { key: 'ffmi.average' }, detail: { key: 'ffmi.men.detail' }, banded: true } as never)).toBe(false);
  });
  it('Calc renders it only through the helper, and every locale has the line', () => {
    expect(read('app/(tabs)/calc.tsx')).toMatch(/showMaleReferenceNote\(sex, ffmiReading\) \? \(/);
    expect(enCatalog['calc.ffmi.maleReference']).toBe('Bands shown are from male reference data.');
    expect(vi['calc.ffmi.maleReference']).toBeTruthy();
    expect(fi['calc.ffmi.maleReference']).toBeTruthy();
  });
});

describe('the fat floor is untouched by polish 6', () => {
  it('the hard floor is still the larger of 20% of kcal and 0.6 g/kg; the cut default warning level is 0.8 g/kg', () => {
    expect(fatFloorGrams(2000, 100)).toBe(60); // 0.6 g/kg beats 20% of kcal (44 g)
    expect(fatFloorGrams(3000, 50)).toBeCloseTo((3000 * 0.2) / 9, 6); // 20% of kcal beats 0.6 g/kg
    expect(read('src/lib/domain/nutrition.ts')).toMatch(/const cutDefault = 0\.8 \* weightKg;/);
  });
});
