import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { borders, fabGeometry, icons, marks, overTargetFill, screenBottomPadding, strokes, warningBoundary } from '../theme/extras';
import { contrastRatio, getTheme, lightColors } from '../theme/theme';
import { FIT_MIN_SCALE, fitTextProps } from './fitLabel';
import { errorKeys, fieldOffset, firstErrorKey } from './scroll';
import { NO_NOTICE, dismissNotice, noticeVisible, raiseNotice } from './storage/notice';
import { openStore } from './storage/store';
import { EMPTY_DATA, type AppData } from './storage/types';
import { assessTargets, targetNotices, typedMeasureRange, validateHeightCm, validateTypedMeasure } from './domain';
import { en } from '../i18n/testing';
import { msg } from '../i18n/msg';
import vi from '../i18n/locales/vi.json';
import fi from '../i18n/locales/fi.json';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
  });
const data = (extra: Partial<AppData> = {}): AppData => ({ ...EMPTY_DATA, logs: [], bodyStats: [], ...extra });

describe('F-1: fit labels have a web fallback', () => {
  it('native shrinks to 80% on one line; web wraps to two lines and never ellipsizes', () => {
    for (const os of ['ios', 'android']) {
      expect(fitTextProps(os)).toEqual({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: FIT_MIN_SCALE });
    }
    expect(FIT_MIN_SCALE).toBe(0.8);
    expect(fitTextProps('web')).toEqual({ numberOfLines: 2, adjustsFontSizeToFit: false });
  });
  it('AppText uses it, and Segmented and Chip still pass fit', () => {
    const ui = read('src/components/ui.tsx');
    expect(ui).toContain('fitTextProps(Platform.OS)');
    const segmented = ui.slice(ui.indexOf('export function Segmented'), ui.indexOf('export function Field'));
    expect(segmented).toMatch(/<AppText variant="secondary" fit /);
    expect(ui.slice(ui.indexOf('export function Chip'))).toMatch(/<AppText variant="bodyMedium" fit /);
  });
});

describe('F-2: a blocked save scrolls to the first invalid field', () => {
  it('firstErrorKey follows screen order, not insertion order, and ignores falsy values', () => {
    const order = ['name', 'kcal', 'proteinG', 'grams'] as const;
    expect(firstErrorKey(order, { grams: true, proteinG: true })).toBe('proteinG');
    expect(firstErrorKey(order, { name: false, kcal: null, grams: 'x' })).toBe('grams');
    expect(firstErrorKey(order, {})).toBeNull();
  });
  it('fieldOffset adds every container above the field', () => {
    const groups = { portion: { y: 400 }, card: { y: 0, parent: 'portion' }, macros: { y: 180, parent: 'card' } };
    expect(fieldOffset(groups, { y: 90, group: 'macros' })).toBe(90 + 180 + 0 + 400);
    expect(fieldOffset(groups, { y: 30 })).toBe(30);
    expect(fieldOffset({}, { y: 30, group: 'missing' })).toBe(30);
  });
  it('errorKeys prefixes so the quick card and the edit card can share field names', () => {
    expect(errorKeys('quick', { kcal: 'x', grams: undefined })).toEqual({ 'quick.kcal': true });
  });
  it('log quick-add and edit, and onboarding body and plan steps, use it', () => {
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/form\.revealFirst\(QUICK_ORDER, errorKeys\('quick', errors\)\)/);
    expect(log).toMatch(/form\.revealFirst\(PORTION_ORDER, errorKeys\('portion', errors\)\)/);
    expect(log).toMatch(/form\.reveal\('portion\.grams'\)/);
    const onboarding = read('app/onboarding.tsx');
    expect(onboarding).toMatch(/form\.revealFirst\(BODY_FIELD_ORDER,/);
    expect(onboarding).toMatch(/form\.revealFirst\(TARGET_FIELD_ORDER,/);
    expect(onboarding).toMatch(/scrollRef=\{scrollRef\}/);
  });
  it('Calc needs no scroll: its Save is disabled while an entry is invalid', () => {
    expect(read('app/(tabs)/calc.tsx')).toMatch(/disabled=\{typedInvalid\}/);
  });
});

describe('F-3 / F-7: catalog wording', () => {
  it('vi appearance.system is "Hệ thống"', () => {
    expect((vi as Record<string, string>)['appearance.system']).toBe('Hệ thống');
  });
  it('fi perusaineenvaihdunta has soft hyphens at the compound joints', () => {
    const text = (fi as Record<string, string>)['validate.bodyImplausible'];
    expect(text).toContain('perus\u00adaineen\u00advaihdunta');
    expect(text.replace(/\u00ad/g, '')).toContain('perusaineenvaihdunta');
  });
});

describe('F-5: the tab bar and inset are counted once', () => {
  const theme = getTheme('light');
  it('FAB sits one margin above the screen bottom, with no tab bar height or inset added', () => {
    const fab = fabGeometry(theme);
    expect(fab.bottom).toBe(theme.spacing.lg);
    expect(fab.bottom).toBeLessThan(theme.sizes.tabBarHeight);
    expect(fab.contentPaddingBottom).toBe(fab.bottom + theme.sizes.fab + theme.spacing.lg);
  });
  it('a tab screen adds neither the bar nor the inset; a screen outside the tabs adds the inset', () => {
    for (const insetBottom of [0, 20, 34]) {
      expect(screenBottomPadding(theme, { insetBottom, belowTabBar: true, fabClearance: false })).toBe(theme.spacing.xxxl);
      expect(screenBottomPadding(theme, { insetBottom, belowTabBar: false, fabClearance: false })).toBe(insetBottom + theme.spacing.xxxl);
      expect(screenBottomPadding(theme, { insetBottom, belowTabBar: true, fabClearance: true })).toBe(fabGeometry(theme).contentPaddingBottom);
    }
    // before: inset + 64 + 32 of blank scroll under every tab screen
    expect(screenBottomPadding(theme, { insetBottom: 34, belowTabBar: true, fabClearance: false })).toBeLessThan(34 + theme.sizes.tabBarHeight);
  });
  it('onboarding sits outside the tab bar', () => {
    expect(read('app/onboarding.tsx')).toMatch(/belowTabBar=\{false\}/);
    expect(read('src/components/ui.tsx')).toMatch(/belowTabBar = true/);
  });
});

describe('F-6: amber caption-only lines carry the warning icon', () => {
  it('no screen has a bare amber caption any more; WarningLine draws the icon and role alert', () => {
    for (const path of ['app/onboarding.tsx', 'app/(tabs)/calc.tsx', 'app/(tabs)/profile.tsx', 'app/(tabs)/log.tsx']) {
      expect(read(path), path).not.toMatch(/variant="caption" color=\{theme\.colors\.warningText\}/);
      expect(read(path), path).toMatch(/<WarningLine/);
    }
    const ui = read('src/components/ui.tsx');
    const line = ui.slice(ui.indexOf('export function WarningLine'), ui.indexOf('export function Card'));
    expect(line).toMatch(/<TriangleAlert/);
    expect(line).toMatch(/accessibilityRole="alert"/);
    expect(line).toMatch(/color=\{theme\.colors\.warningText\}/);
  });
  it('target notices keep their test ids', () => {
    expect(read('app/onboarding.tsx')).toMatch(/<WarningLine key=\{notice\.message\.key\} testID=\{`notice-\$\{notice\.field\}`\}>/);
    expect(read('app/(tabs)/profile.tsx')).toMatch(/testID=\{`notice-\$\{notice\.field\}`\}/);
  });
});

describe('F-10: size literals are tokens', () => {
  it('no icon size, border width, logo or circle literal is left in screens or components', () => {
    for (const path of [...files('app'), ...files('src/components')]) {
      const source = read(path);
      expect(source, path).not.toMatch(/\bsize=\{\d/);
      expect(source, path).not.toMatch(/strokeWidth=\{\d/);
      expect(source, path).not.toMatch(/borderWidth: [\d.]/);
      expect(source, path).not.toMatch(/\b(width|height): (9[0-9]|3[0-9]|[1-9]\d{2}),/);
    }
  });
  it('the tokens hold the old values', () => {
    expect(icons).toEqual({ sm: 18, md: 20, nav: 22, fab: 28 });
    expect(strokes).toEqual({ regular: 2, nav: 2.2, bold: 2.4, tabActive: 2.6 });
    expect(borders).toEqual({ thin: 1, emphasis: 1.5, focus: 2 });
    expect([marks.logo, marks.logoRadius, marks.addCircle]).toEqual([96, 22, 32]);
  });
});

describe('F-11: Erase is distinct, the notice is dismissible, the write block stays', () => {
  it('Erase is a destructive-tone secondary button; Retry stays default', () => {
    const ui = read('src/components/ui.tsx');
    const banner = ui.slice(ui.indexOf('export function StorageBanner'), ui.indexOf('export function WarningNotice'));
    expect(banner).toMatch(/testID="storage-retry" \/>/);
    expect(banner).toMatch(/testID="reset-unreadable" tone="destructive"/);
    expect(banner).toMatch(/onDismiss=\{dismissError\}/);
    expect(banner).toMatch(/if \(!error \|\| !noticeVisible\) return null/);
    const button = ui.slice(ui.indexOf('export function SecondaryButton'), ui.indexOf('export function SecondaryButton') + 1800);
    expect(button).toMatch(/destructive \? warningBoundary\(theme\)/);
    expect(button).toMatch(/destructive \? theme\.colors\.warningText/);
    expect(contrastRatio(lightColors.warningText, lightColors.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('dismissing hides the card only; a new failure shows it again', () => {
    const failure = msg('storage.saveFailed');
    let state = raiseNotice(failure);
    expect(noticeVisible(state)).toBe(true);
    state = dismissNotice(state);
    expect(state.error).toEqual(failure);
    expect(noticeVisible(state)).toBe(false);
    state = raiseNotice(failure);
    expect(noticeVisible(state)).toBe(true);
    expect(dismissNotice(NO_NOTICE)).toEqual(NO_NOTICE);
    expect(noticeVisible(NO_NOTICE)).toBe(false);
  });
  it('the store keeps refusing writes after a dismissal (the block lives in the store, not the card)', async () => {
    let writes = 0;
    const store = await openStore({
      load: async () => { throw new Error('corrupt'); },
      save: async () => { writes += 1; },
      backupRaw: async () => {},
    });
    expect(store.isBlocked()).toBe(true);
    dismissNotice(raiseNotice(msg('storage.saveFailed')));
    const attempt = await store.commit((cur) => ({ ...cur, language: 'vi' }));
    expect(attempt.ok).toBe(false);
    expect(writes).toBe(0);
    expect(store.isBlocked()).toBe(true);
    expect(read('src/state/AppContext.tsx')).toMatch(/dismissError = useCallback\(\(\) => setNotice\(dismissNotice\)/);
    expect(read('src/state/AppContext.tsx')).not.toMatch(/dismissError[^\n]*(retry|reset|blocked)/i);
  });
  it('the dismiss button has a 44 px target and a translated label in every locale', () => {
    expect(read('src/components/ui.tsx')).toMatch(/width: theme\.sizes\.minTouchTarget, height: theme\.sizes\.minTouchTarget/);
    expect(en(msg('common.dismiss'))).toBe('Dismiss');
    expect((vi as Record<string, string>)['common.dismiss']).toBe('Đóng');
    expect((fi as Record<string, string>)['common.dismiss']).toBe('Sulje');
  });
});

describe('F-12: over-target rings and bars use the warning fill', () => {
  it('fill is the amber warning colour with a warningText-family outline; warningText stays for text', () => {
    const theme = getTheme('light');
    expect(overTargetFill(theme)).toBe(lightColors.warning);
    expect(overTargetFill(theme)).not.toBe(warningBoundary(theme));
    const ring = read('src/components/Ring.tsx');
    expect(ring).toMatch(/const color = over \? overTargetFill\(theme\)/);
    expect(ring).toMatch(/stroke=\{warningBoundary\(theme\)\}/);
    expect(ring).toMatch(/color=\{over \? theme\.colors\.warningText/);
    const trends = read('app/(tabs)/trends.tsx');
    expect(trends).toMatch(/over=\{overTargetFill\(theme\)\}/);
    expect(trends).toMatch(/stroke=\{target > 0 && value > target \? overOutline : undefined\}/);
  });
});

describe('F-13: docs say label shrinking is native-only', () => {
  it('docs/i18n.md', () => {
    const docs = read('docs/i18n.md');
    expect(docs).toMatch(/Label shrinking is native-only/);
    expect(docs).toMatch(/two lines/);
  });
});

describe('Heisenberg: Profile plan notes', () => {
  it('are owned by the screen (so a save-triggered remount keeps them) and cleared by any edit or new save', () => {
    const profile = read('app/(tabs)/profile.tsx');
    expect(profile).toMatch(/const \[shownPlanNotes, setShownPlanNotes\] = useState<Msg\[\]>\(\[\]\)/);
    const clear = profile.slice(profile.indexOf('const clearNotice'), profile.indexOf('const clearNotice') + 260);
    expect(clear).toMatch(/setShownPlanNotes\(\[\]\)/);
    expect(profile).toMatch(/type: 'save-attempt' \}\)\);[^\n]*\n\s*setShownPlanNotes\(\[\]\)/);
    expect(profile).toMatch(/onPlanNotes\(!profile\.targets\.custom \|\| recalculate \? planNotes\(plan\) : \[\]\)/);
  });
  it('the target editor clears them too (it shares clearNotice)', () => {
    expect(read('app/(tabs)/profile.tsx').match(/onNotice=\{clearNotice\}/g)).toHaveLength(2);
  });
});

describe('Heisenberg: protein note is for strictly over 35%', () => {
  const note = (kcal: number, proteinG: number) => targetNotices({ kcal, proteinG, carbsG: 100, fatG: 50 }).find((issue) => issue.field === 'proteinG');
  it('does not fire at the cap, within the slack, or when the share still rounds to 35%', () => {
    expect(note(2000, 175)).toBeUndefined();
    expect(note(2000, 175.6)).toBeUndefined();
    expect(note(10000, 875.7)).toBeUndefined(); // 35.03% -> would have read "about 35%, above 35%"
  });
  it('fires above the cap and quotes the real share with one decimal', () => {
    expect(en(note(2000, 176)!.message)).toMatch(/about 35\.2% of your calories/);
    expect(en(note(2000, 375)!.message)).toMatch(/about 75% of your calories/);
    expect(assessTargets({ kcal: 2000, proteinG: 175, carbsG: 150, fatG: 60 }, 'male', 1800, 80, 2500, 'maintain').issues.some((i) => i.field === 'proteinG')).toBe(false);
  });
  it('never says the same number it is above', () => {
    for (let kcal = 1200; kcal <= 6000; kcal += 100) {
      for (let g = Math.floor((kcal * 0.35) / 4) - 2; g <= Math.ceil((kcal * 0.35) / 4) + 4; g += 0.1) {
        const found = note(kcal, Math.round(g * 10) / 10);
        if (!found) continue;
        const pct = Number((found.message.params as { pct: number }).pct);
        expect(pct).toBeGreaterThan(35);
      }
    }
  });
});

describe('Onboarding imperial height message', () => {
  it('quotes feet and inches from the same range the Calc box uses', () => {
    const { lo, hi } = typedMeasureRange('height', 'imperial');
    expect([lo, hi]).toEqual([48, 90]);
    const bad = validateHeightCm(100, 'imperial');
    expect(bad.ok).toBe(false);
    expect(bad.message).toEqual(msg('validate.height.rangeImperial', { minFt: 4, minIn: 0, maxFt: 7, maxIn: 6 }));
    expect(en(bad.message!)).toBe('Enter a height from 4 ft 0 in to 7 ft 6 in.');
    expect(en(bad.message!)).not.toMatch(/cm/);
  });
  it('accepts exactly what Calc accepts, at both ends and in the middle', () => {
    for (const inches of [48, 59, 71.5, 90]) {
      const cm = inches * 2.54;
      expect(validateHeightCm(cm, 'imperial').ok, `${inches} in`).toBe(true);
      expect(validateTypedMeasure('height', String(inches), 'imperial').ok, `calc ${inches}`).toBe(true);
    }
    for (const inches of [47.9, 90.1]) {
      expect(validateHeightCm(inches * 2.54, 'imperial').ok, `${inches} in`).toBe(false);
    }
  });
  it('metric is unchanged and still quotes centimetres', () => {
    expect(validateHeightCm(99).ok).toBe(false);
    expect(en(validateHeightCm(99).message!)).toBe('Enter a height from 100 to 250 cm.');
    expect(validateHeightCm(180, 'metric').ok).toBe(true);
  });
  it('the screens pass the unit', () => {
    expect(read('app/onboarding.tsx')).toMatch(/validateHeightCm\(heightCm, units\)/);
    expect(read('app/(tabs)/profile.tsx')).toMatch(/validateHeightCm\(heightCm, profile\.units\)/);
    expect(read('app/onboarding.tsx')).toMatch(/testID="height-error"/);
  });
  it('the message exists in vi and fi with the same placeholders', () => {
    for (const catalog of [vi, fi] as Record<string, string>[]) {
      const text = catalog['validate.height.rangeImperial'];
      for (const p of ['minFt', 'minIn', 'maxFt', 'maxIn']) expect(text).toContain(`{{${p}}}`);
    }
  });
});
