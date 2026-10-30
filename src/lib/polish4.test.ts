import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayKcal, displayKcalTotal, remainingDisplay } from './domain';
import { formatKcal } from './format';
import { BODY_STAT, LOG, PROFILE } from './testFixtures';
import { appearanceOf, preferencesToKeep, withAppearance } from './storage/prefs';
import { parseStoredData } from './storage/shape';
import { openStore } from './storage/store';
import type { AppData } from './storage/types';
import { OVER_BAR_MIN_OUTLINE_WIDTH, borders, contrastRatio, insetRect, overBarPaint, overRingStrokes, overTargetFill, warningBoundary } from '../theme/extras';
import { getTheme } from '../theme/theme';
import { en } from '../i18n/testing';
import enCatalog from '../i18n/locales/en.json';
import vi from '../i18n/locales/vi.json';
import fi from '../i18n/locales/fi.json';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
  });
const light = getTheme('light');
const dark = getTheme('dark');
const cat = (locale: Record<string, string>, key: string) => locale[key].replace(/\u00a0/g, ' ');

describe('UI-R3-1: one kcal rounding, rows add up to the total on every screen', () => {
  // Nacho's case: quick adds of 350, 520.5 and 129.7 kcal (exact total 1000.2).
  const entries = [{ id: 'a', kcal: 350 }, { id: 'e', kcal: 520.5 }, { id: 'c', kcal: 129.7 }];
  it('every row shows the same value on Log and Today, and the rows add up to the displayed total', () => {
    const logRows = entries.map((entry) => displayKcal(entry.kcal)); // Log: displayKcal(entry.kcal)
    const todayRows = entries.map((entry) => displayKcal(entry.kcal)); // Today: displayKcal(item.kcal)
    expect(logRows).toEqual([350, 521, 130]);
    expect(todayRows).toEqual(logRows);
    expect(logRows.reduce((sum, value) => sum + value, 0)).toBe(displayKcalTotal(entries));
    expect(displayKcalTotal(entries)).toBe(1001);
    expect(entries.map((entry) => en({ key: 'today.itemDetail', params: { grams: 100, kcal: formatKcal(displayKcal(entry.kcal)), p: 0, c: 0, f: 0, fiber: '—' } })).join('|')).toMatch(/350 kcal.*521 kcal.*130 kcal/);
  });
  it('a row does not change when other entries are added (the old allocation moved 520.5 to 520)', () => {
    expect(displayKcal(520.5)).toBe(521);
    for (const others of [[], [350], [350, 129.7], [350, 129.7, 0.4, 88.8]]) {
      const all = [{ kcal: 520.5 }, ...others.map((kcal) => ({ kcal }))];
      expect(displayKcal(all[0].kcal)).toBe(521);
      expect(displayKcalTotal(all)).toBe(all.reduce((sum, entry) => sum + displayKcal(entry.kcal), 0));
    }
  });
  it('meal subtotals, the day total, the ring and "left" all come from the same rounded rows', () => {
    const meals = { breakfast: [{ kcal: 350 }], dinner: [{ kcal: 520.5 }, { kcal: 129.7 }] };
    const subtotals = Object.values(meals).map((items) => displayKcalTotal(items));
    const day = displayKcalTotal(Object.values(meals).flat());
    expect(subtotals).toEqual([350, 651]);
    expect(subtotals.reduce((sum, value) => sum + value, 0)).toBe(day);
    expect(remainingDisplay(day, 1945)).toMatchObject({ consumed: 1001, kind: 'left', amount: 944 });
    expect(remainingDisplay(day, 1945).consumed + remainingDisplay(day, 1945).amount).toBe(1945);
  });
  it('rows are whole numbers, including under 100 kcal (no 52.5 on one screen and 53 on the other)', () => {
    for (const kcal of [0, 0.4, 52.5, 99.5, 99.4, 100.5]) {
      expect(Number.isInteger(displayKcal(kcal))).toBe(true);
      expect(formatKcal(displayKcal(kcal))).not.toMatch(/[.,]\d/);
    }
  });
  it('Log, Today and Trends use displayKcal; the largest-remainder allocation is gone', () => {
    expect(read('app/(tabs)/log.tsx')).toMatch(/formatKcal\(displayKcal\(entry\.kcal\)\)/);
    const today = read('app/(tabs)/index.tsx');
    expect(today).toMatch(/formatKcal\(displayKcal\(item\.kcal\)\)/);
    expect(today).toMatch(/const dayKcal = displayKcalTotal\(entries\)/);
    expect(today).toMatch(/const subtotal = displayKcalTotal\(items\)/);
    expect(today).toMatch(/consumed=\{dayKcal\}/);
    expect(read('app/(tabs)/trends.tsx')).toMatch(/sum \+ displayKcal\(entry\.kcal\)/);
    for (const path of [...files('app'), ...files('src'), 'src/lib/domain/portion.ts', 'src/lib/domain/index.ts']) {
      expect(read(path), path).not.toMatch(/roundToSum/);
    }
  });
});

describe('UI-R3-2: no floating + on top of the empty Today card', () => {
  it('the FAB is only drawn when there are entries, and only then does the scroll leave room for it', () => {
    const today = read('app/(tabs)/index.tsx');
    expect(today).toMatch(/const showFab = entries\.length > 0/);
    expect(today).toMatch(/<Screen testID="screen-today" fabClearance=\{showFab\}>/);
    expect(today).toMatch(/\{showFab \? \(\s*<Pressable[\s\S]*?today\.logFood[\s\S]*?\) : null\}/);
    expect(today).toMatch(/today\.logMeal/); // the empty card keeps its own Log a meal button
  });
});

describe('C-14: Calc hides the stale BMR line while an input is invalid', () => {
  it('FormulaPicker takes hideBmr and Calc passes the typed-invalid flag', () => {
    const picker = read('src/components/BmrChoices.tsx');
    expect(picker).toMatch(/hideBmr \? null : \(/);
    expect(picker).toMatch(/formula\.bmr/);
    expect(read('app/(tabs)/calc.tsx')).toMatch(/<FormulaPicker [^>]*hideBmr=\{typedInvalid\}/);
    expect(read('app/(tabs)/calc.tsx')).toMatch(/const typedInvalid = \[typedHeight, typedWeight, typedAge\]/);
  });
});

describe('surplus warning says "or"', () => {
  it('en, vi and fi', () => {
    expect(cat(enCatalog, 'projection.surplusFat.both')).toBe('Large surplus (> +500 kcal or > 15% of TDEE): much of the gain will be fat, not muscle.');
    expect(cat(vi, 'projection.surplusFat.both')).toMatch(/> \+500 kcal hoặc > 15%/);
    expect(cat(fi, 'projection.surplusFat.both')).toMatch(/> \+500 kcal tai > 15 %/);
    for (const locale of [enCatalog, vi, fi] as Record<string, string>[]) expect(locale['projection.surplusFat.both']).not.toMatch(/ and | và | ja /);
  });
});

describe('vi and fi do not use the bare acronym TDEE', () => {
  it('uses the maintenance term the app already uses for it', () => {
    for (const locale of [vi, fi] as Record<string, string>[]) {
      for (const [key, value] of Object.entries(locale)) expect(value, key).not.toMatch(/TDEE/);
    }
    expect(vi['projection.surplusFat.pct']).toMatch(/mức duy trì/);
    expect(vi['projection.offsetClamped']).toMatch(/25% mức duy trì/);
    expect(fi['projection.surplusFat.pct']).toMatch(/ylläpitotasosta/);
    expect(fi['projection.offsetClamped']).toMatch(/ylläpitotasosta/);
    expect(vi['calc.maintenance']).toBe('Mức duy trì');
  });
});

describe('a disabled cut card shows it is unavailable, not "about 20% under maintenance"', () => {
  it('onboarding swaps the detail when blocked; the reason stays under the card; all locales have the text', () => {
    const onboarding = read('app/onboarding.tsx');
    expect(onboarding).toMatch(/detail=\{blocked \? t\('goal\.cut\.unavailable'\) : tm\(GOAL_DETAILS\[option\]\.description\)\}/);
    expect(onboarding).toMatch(/\{blocked && reason \? <WarningLine>\{tm\(reason\)\}<\/WarningLine> : null\}/);
    expect(en(enCatalog['goal.cut.unavailable'] ? { key: 'goal.cut.unavailable' } : { key: 'goal.cut' })).toBe('Not available — see why below');
    for (const locale of [vi, fi] as Record<string, string>[]) {
      expect(locale['goal.cut.unavailable']).toBeTruthy();
      expect(locale['goal.cut.unavailable']).not.toBe(locale['goal.cut.desc']);
    }
  });
});

describe('Reset keeps the language and appearance', () => {
  const data = (extra: Partial<AppData> = {}): AppData => ({ profile: PROFILE as unknown as AppData['profile'], logs: [LOG as unknown as AppData['logs'][0]], bodyStats: [BODY_STAT as unknown as AppData['bodyStats'][0]], ...extra });
  it('the store keeps them and drops everything else', async () => {
    const saved: AppData[] = [];
    const store = await openStore({ load: async () => data({ language: 'vi', appearance: 'dark' }), save: async (next) => { saved.push(next); }, backupRaw: async () => {} });
    const result = await store.reset();
    expect(result.ok).toBe(true);
    expect(saved.at(-1)).toEqual({ profile: null, logs: [], bodyStats: [], language: 'vi', appearance: 'dark' });
  });
  it('an appearance saved only on an older profile is kept too; unset preferences stay unset', async () => {
    expect(preferencesToKeep(data({ profile: { ...PROFILE, appearance: 'light' } as unknown as AppData['profile'] }))).toEqual({ appearance: 'light' });
    const store = await openStore({ load: async () => ({ profile: null, logs: [], bodyStats: [] }), save: async () => {}, backupRaw: async () => {} });
    expect(await store.reset()).toMatchObject({ ok: true, data: { profile: null, logs: [], bodyStats: [] } });
    expect(preferencesToKeep({ profile: null, logs: [], bodyStats: [] })).toEqual({});
  });
  it('choosing an appearance writes the top level and the profile; the top level wins', () => {
    const next = withAppearance(data(), 'dark');
    expect(next.appearance).toBe('dark');
    expect(next.profile?.appearance).toBe('dark');
    expect(appearanceOf({ appearance: 'light', profile: next.profile })).toBe('light');
    expect(appearanceOf({ profile: null })).toBe('system');
    expect(withAppearance({ profile: null, logs: [], bodyStats: [] }, 'light').profile).toBeNull();
  });
  it('the stored shape accepts and validates the top-level appearance', () => {
    expect(parseStoredData(JSON.stringify({ appearance: 'dark', language: 'fi' }))).toEqual({ profile: null, logs: [], bodyStats: [], language: 'fi', appearance: 'dark' });
    expect(parseStoredData(JSON.stringify({ appearance: 'neon' }))).not.toHaveProperty('appearance');
  });
  it('after a reset, onboarding starts the new profile with the kept appearance, and the app theme reads it', () => {
    expect(read('app/onboarding.tsx')).toMatch(/appearance: appearanceOf\(data\)/);
    expect(read('src/state/AppContext.tsx')).toMatch(/const appearance = appearanceOf\(data\)/);
    expect(read('app/(tabs)/profile.tsx')).toMatch(/value=\{appearanceOf\(data\)\}/);
    expect(read('app/(tabs)/profile.tsx')).toMatch(/void setAppearance\(appearance\)/);
  });
  it('resetAll applies the kept language to the UI', () => {
    expect(read('src/state/AppContext.tsx')).toMatch(/setLocale\(resolvePreference\(result\.data\.language \?\? 'system'/);
  });
});

describe('F-12: over-target ring (light, dark) and bars', () => {
  it('light ring: total stroke stays 16, a 16 px warningText stroke under a 13 px warning stroke', () => {
    expect(overRingStrokes(light, 16)).toEqual({ outline: 16, fill: 13 });
    expect(borders.emphasis * 2).toBe(3);
  });
  it('light ring: nothing is wider than the 16 px band, so nothing is clipped at the box edge', () => {
    // Ring.tsx: size 220, stroke 16, radius (size - stroke) / 2 = 102; the outer edge is radius + stroke / 2.
    const { outline, fill } = overRingStrokes(light, 16);
    const radius = (220 - 16) / 2;
    expect(radius + Math.max(outline!, fill) / 2).toBe(110);
    expect(radius + Math.max(outline!, fill) / 2).toBeLessThanOrEqual(220 / 2);
    expect(radius - Math.max(outline!, fill) / 2).toBe(94); // inner hole unchanged vs the normal ring
  });
  it('dark ring: no outline at all, the fill keeps the full 16', () => {
    expect(overRingStrokes(dark, 16)).toEqual({ outline: null, fill: 16 });
  });
  it('the outline colour is warningText, the fill is warning; dark needs no outline because the fill is already readable', () => {
    expect(overTargetFill(light)).not.toBe(warningBoundary(light));
    expect(contrastRatio(warningBoundary(light), light.colors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(overTargetFill(dark), dark.colors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(overTargetFill(dark), dark.colors.border)).toBeGreaterThanOrEqual(3);
  });
  it('Ring.tsx draws the outline only when there is one, and uses the fill width for the amber arc', () => {
    const ring = read('src/components/Ring.tsx');
    expect(ring).toMatch(/const overStrokes = overRingStrokes\(theme, stroke\)/);
    expect(ring).toMatch(/over && overStrokes\.outline != null/);
    expect(ring).toMatch(/strokeWidth=\{overStrokes\.outline\}/);
    expect(ring).toMatch(/strokeWidth=\{over \? overStrokes\.fill : stroke\}/);
    expect(ring).not.toMatch(/stroke \+ outline/);
  });
  it('bars: light, wide enough: warning fill with a warningText outline inset inside the bar rect', () => {
    expect(overBarPaint(light, 35)).toEqual({ fill: light.colors.warning, outline: light.colors.warningText });
    const bar = { x: 10, y: 20, width: 35, height: 40 };
    const inner = insetRect(bar, borders.emphasis);
    expect(inner).toEqual({ x: 11.5, y: 21.5, width: 32, height: 37 });
    // the fill rect is inside the outline rect: the bar's footprint is exactly the outline rect
    expect(inner.x).toBeGreaterThanOrEqual(bar.x);
    expect(inner.x + inner.width).toBeLessThanOrEqual(bar.x + bar.width);
    expect(inner.y + inner.height).toBeLessThanOrEqual(bar.y + bar.height);
  });
  it('bars: narrow (under 8 units) skip the outline; light uses a solid warningText bar', () => {
    expect(OVER_BAR_MIN_OUTLINE_WIDTH).toBe(8);
    for (const width of [4, 5.1, 7.99]) expect(overBarPaint(light, width)).toEqual({ fill: light.colors.warningText, outline: null });
    expect(overBarPaint(light, 8).outline).not.toBeNull();
    // widths from real ranges in the 270-unit plot: n = 7, 14, 30, 90
    const widths = [7, 14, 30, 90].map((n) => Math.max(4, (270 - 4 * (n - 1)) / n));
    expect(widths.map((w) => overBarPaint(light, w).outline !== null)).toEqual([true, true, false, false]);
  });
  it('bars: dark never has an outline', () => {
    for (const width of [4, 8, 35]) expect(overBarPaint(dark, width)).toEqual({ fill: dark.colors.warning, outline: null });
  });
  it('insetRect never goes negative on tiny bars', () => {
    expect(insetRect({ x: 0, y: 0, width: 2, height: 1 }, 1.5)).toMatchObject({ width: 0, height: 0 });
  });
  it('trends draws the outline rect as the bar and the fill inset inside it', () => {
    const trends = read('app/(tabs)/trends.tsx');
    expect(trends).toMatch(/overBarPaint\(theme, barWidth\)/);
    expect(trends).toMatch(/insetRect\(bar, borders\.emphasis\)/);
    expect(trends).not.toMatch(/strokeWidth=\{target > 0 && value > target/);
    expect(trends).not.toMatch(/overOutline/);
  });
});

describe('F-6: no warningText AppText outside the warning components', () => {
  // The only deliberate uses: the BMI class name (a label with its own words), the "†" marker next to a clamped
  // projection row, and the ring's "over by" status line, which sits right under the outlined ring.
  const allowed = [
    /color=\{bmiTone\(bmi\) === 'success' \? theme\.colors\.successText : theme\.colors\.warningText\}/,
    /\{`\$\{NBSP\}†`\}/,
    /color=\{over \? theme\.colors\.warningText : theme\.colors\.textSecondary\}/,
  ];
  it('every AppText coloured warningText is a known label, never a message line', () => {
    for (const path of [...files('app'), ...files('src/components')]) {
      if (path.endsWith('src/components/ui.tsx')) continue; // WarningNotice and WarningLine are the components themselves
      const source = read(path);
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (!/colors\.warningText/.test(line)) return;
        const context = lines.slice(Math.max(0, index - 1), index + 2).join('\n');
        if (!/<AppText/.test(context)) return;
        expect(allowed.some((pattern) => pattern.test(context)), `${path}:${index + 1}: ${line.trim()}`).toBe(true);
      });
    }
  });
  it('the two calc lines are WarningLines now', () => {
    const calc = read('app/(tabs)/calc.tsx');
    expect(calc).toMatch(/<WarningLine testID="calc-deficit-unavailable">\{tm\(DEFICIT_UNAVAILABLE_MESSAGE\)\}<\/WarningLine>/);
    expect(calc).toMatch(/<WarningLine testID="calc-mostly-fat">\{t\('calc\.mostlyFat'\)\}<\/WarningLine>/);
  });
});

describe('P3: a warning scrolls into view once, when it first appears', () => {
  it('Log uses revealOnce and re-arms it when the warning goes away', () => {
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/form\.revealOnce\('portion\.warning'\)/);
    expect(log).toMatch(/form\.revealOnce\('quick\.warning'\)/);
    expect(log).not.toMatch(/form\.reveal\('(portion|quick)\.warning'\)/);
    expect(log).toMatch(/if \(!quickWarningShown\) form\.forget\('quick\.warning'\)/);
    expect(log).toMatch(/if \(!editWarningShown\) form\.forget\('portion\.warning'\)/);
    const hook = read('src/lib/formScroll.ts');
    expect(hook).toMatch(/revealed\.current\.has\(key\)/);
    expect(hook).toMatch(/forget: \(key: K\) => \{ revealed\.current\.delete\(key\)/);
  });
});

describe('P3: a standing "Storage problem" entry stays reachable after the card is dismissed', () => {
  it('shows only while a problem exists and the card is hidden; Retry, and Erase after a confirm for unreadable data', () => {
    const ui = read('src/components/ui.tsx');
    const block = ui.slice(ui.indexOf('export function StorageProblem'), ui.indexOf('export function WarningNotice'));
    expect(block).toMatch(/if \(!error \|\| noticeVisible\) return null/);
    expect(block).toMatch(/storage\.retry/);
    expect(block).toMatch(/readFailed && !confirming/);
    expect(block).toMatch(/readFailed && confirming/);
    expect(block).toMatch(/profile\.eraseWarning/);
    expect(block).toMatch(/\{t\('storage\.problem'\)\} \{tm\(error\)\}/);
  });
  it('Profile (both branches) and onboarding render it; the new string exists in every locale', () => {
    expect(read('app/(tabs)/profile.tsx').match(/<StorageProblem \/>/g)).toHaveLength(2);
    expect(read('app/onboarding.tsx')).toMatch(/<StorageProblem \/>/);
    expect(enCatalog['storage.problem']).toBe('Storage problem.');
    expect(vi['storage.problem']).toBeTruthy();
    expect(fi['storage.problem']).toBeTruthy();
  });
});
