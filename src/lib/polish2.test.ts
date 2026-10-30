import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fabGeometry, warningBoundary } from '../theme/extras';
import { chartTextProps } from '../theme/chartText';
import { contrastRatio, darkColors, getTheme, lightColors } from '../theme/theme';
import { scrollTargetY } from './scroll';
import { onboardingHint } from './onboardingHint';
import { TAB_ROUTES } from './tabs';
import { openStore } from './storage/store';
import { EMPTY_DATA, type AppData } from './storage/types';
import { en } from '../i18n/testing';
import { msg } from '../i18n/msg';

const root = join(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? sourceFiles(path) : /\.tsx$/.test(name) ? [path] : [];
  });
}

const data = (extra: Partial<AppData> = {}): AppData => ({ ...EMPTY_DATA, logs: [], bodyStats: [], ...extra });

describe('B P1: storage error banner is a card with an icon, warningText and a Retry action', () => {
  it('banner source: framed WarningNotice, Retry button, erase only on read failures', () => {
    const ui = read('src/components/ui.tsx');
    const banner = ui.slice(ui.indexOf('export function StorageBanner'), ui.indexOf('export function WarningNotice'));
    expect(banner).toMatch(/<WarningNotice framed/);
    expect(banner).toMatch(/storage\.retry/);
    expect(banner).toMatch(/readFailed \?[\s\S]*storage\.eraseUnreadable/);
    const notice = ui.slice(ui.indexOf('export function WarningNotice'));
    expect(notice).toMatch(/<TriangleAlert/);
    expect(notice).toMatch(/backgroundColor: theme\.colors\.surface/);
    expect(notice).toMatch(/color=\{theme\.colors\.warningText\}/);
    expect(notice).toMatch(/accessibilityRole="alert"/);
  });

  it('Retry after a failed save applies the change that failed', async () => {
    let failing = true;
    const saved: AppData[] = [];
    const store = await openStore({
      load: async () => data(),
      save: async (next) => { if (failing) throw new Error('disk full'); saved.push(next); },
      backupRaw: async () => {},
    });
    const failed = await store.commit((cur) => ({ ...cur, language: 'vi' }));
    expect(failed.ok).toBe(false);
    expect(store.get().language).toBeUndefined();
    failing = false;
    const retried = await store.retry();
    expect(retried.ok).toBe(true);
    expect(store.get().language).toBe('vi');
    expect(saved).toHaveLength(1);
    // Nothing left to retry: a second Retry changes and writes nothing.
    await store.retry();
    expect(saved).toHaveLength(1);
  });

  it('Retry after a failed read re-reads, and lifts the write block only when the data is readable', async () => {
    let readable = false;
    let writes = 0;
    const store = await openStore({
      load: async () => { if (!readable) throw new Error('corrupt'); return data({ language: 'fi' }); },
      save: async () => { writes += 1; },
      backupRaw: async () => {},
    });
    expect(store.loadError()).toBe(true);
    const still = await store.retry();
    expect(still.ok).toBe(false);
    expect(store.isBlocked()).toBe(true);
    expect(writes).toBe(0);
    readable = true;
    const now = await store.retry();
    expect(now.ok).toBe(true);
    expect(store.isBlocked()).toBe(false);
    expect(store.get().language).toBe('fi');
    expect(writes).toBe(0);
  });
});

describe('B P1: quick-add and edit warnings scroll into view', () => {
  it('computes a non-negative offset from the card and the warning inside it', () => {
    expect(scrollTargetY(400, 300, 24)).toBe(676);
    expect(scrollTargetY(0, 10, 24)).toBe(0);
    expect(scrollTargetY(Number.NaN, 5, 24)).toBe(0);
  });
  it('log.tsx scrolls on both the quick-add and the edit warning', () => {
    const log = read('app/(tabs)/log.tsx');
    expect(log).toMatch(/scrollRef=\{scrollRef\}/);
    expect(log).toMatch(/testID="quick-warning" onLayout=\{\(event\) => \{ form\.field\('quick\.warning', 'quickCard'\)\(event\); form\.revealOnce\('quick\.warning'\); \}\}/);
    expect(log).toMatch(/testID="edit-warning" onLayout=\{\(event\) => \{ form\.field\('portion\.warning', 'portionCard'\)\(event\); form\.revealOnce\('portion\.warning'\); \}\}/);
  });
});

describe('B P1-3: the floating button never covers the last row', () => {
  it('content padding always ends above the button, for every inset', () => {
    const theme = getTheme('light');
    const fab = fabGeometry(theme);
    expect(fab.contentPaddingBottom).toBeGreaterThanOrEqual(fab.top + theme.spacing.lg);
    expect(fab.top - fab.bottom).toBe(theme.sizes.fab);
  });
  it('Screen and the button read the same geometry', () => {
    expect(read('src/components/ui.tsx')).toMatch(/screenBottomPadding\(theme, \{ insetBottom: insets\.bottom, belowTabBar, fabClearance, minimum: bottomClearance \}\)/);
    expect(read('app/(tabs)/index.tsx')).toMatch(/bottom: fabGeometry\(theme\)\.bottom/);
  });
});

describe('B P2: Trends chart text', () => {
  it('uses the caption token and its font family, in every locale', () => {
    for (const locale of ['en', 'vi', 'fi']) {
      const theme = getTheme('light', locale);
      expect(chartTextProps(theme)).toEqual({ fontFamily: theme.fontFamilies.body, fontSize: theme.typography.caption.fontSize });
    }
  });
  it('no SVG label keeps a literal fontSize', () => {
    const trends = read('app/(tabs)/trends.tsx');
    expect(trends).not.toMatch(/fontSize="/);
    expect(trends.match(/<SvgText /g)?.length).toBe(trends.match(/<SvgText [^>]*\{\.\.\.labelProps\}/g)?.length);
  });
});

describe('B P2: search rows, legends, warnings', () => {
  it('search rows show P/C/F with MacroTokens, not grey text', () => {
    expect(read('app/(tabs)/log.tsx')).toMatch(/<MacroTokens protein=\{food\.proteinPer100g\}/);
    expect(en(msg('log.resultDetail', { kcal: '120', fiber: '2' }))).toBe('120 kcal / 100 g · fiber 2');
  });
  it('the dagger legend appears once, under the table, and the dagger itself is amber', () => {
    const calc = read('app/(tabs)/calc.tsx');
    expect(calc.match(/calc\.clampedNote/g)).toHaveLength(1);
    expect(calc).toMatch(/clamped-legend/);
    expect(calc).toMatch(/color=\{theme\.colors\.warningText\}>\{`\$\{NBSP\}†`\}/);
  });
  it('warning outlines and rings use warningText: at least 3:1 on surface and background in both schemes', () => {
    for (const colors of [lightColors, darkColors]) {
      const boundary = warningBoundary({ colors });
      expect(contrastRatio(boundary, colors.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(boundary, colors.background)).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(lightColors.warning, lightColors.surface)).toBeLessThan(3); // why the swap was needed
    expect(read('src/components/Ring.tsx')).toMatch(/stroke=\{warningBoundary\(theme\)\}/);
    expect(read('src/components/ui.tsx')).toMatch(/error \? warningBoundary\(theme\)/);
    expect(read('app/(tabs)/trends.tsx')).toMatch(/overBarPaint\(theme, barWidth\)/); // outline colour comes from warningBoundary via the helper
  });
  it('quick-add, calc and onboarding warnings carry an icon through WarningNotice', () => {
    expect(read('app/(tabs)/calc.tsx')).toMatch(/<WarningNotice testID="calc-fix-entry"/);
    expect(read('app/(tabs)/log.tsx')).toMatch(/<WarningNotice testID="quick-warning"/);
    expect(read('app/onboarding.tsx')).toMatch(/<WarningNotice testID="body-implausible"/);
  });
});

describe('B P2: tabs, empty state, literals, onboarding hint', () => {
  it('every tab draws a filled icon when active', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    const icon = read('src/components/TabIcon.tsx');
    for (const route of TAB_ROUTES) {
      expect(layout).toContain(`<TabIcon route="${route}"`);
      expect(icon).toContain(`route === '${route}'`);
    }
    expect(icon).toMatch(/fill=\{fill\}/);
    expect(icon).toContain('tab-icon-calc-filled');
    expect(icon).toContain('tab-icon-trends-filled');
  });
  it('the empty Today heading asks for the first meal, in every language', () => {
    expect(en(msg('today.emptyTitle'))).toBe('Log your first meal');
  });
  it('no spacing, gap or size literal is left in screens and components', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles('app'), ...sourceFiles('src/components')]) {
      read(file).split('\n').forEach((line, index) => {
        if (/\b(gap|margin\w*|padding\w*|minHeight|height|width): (4|8|12|16|44|64)\b/.test(line) && !/\bheight: (CHART|size)/.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
  it('onboarding hint says what is missing before Next is tapped', () => {
    const base = { step: 1, hasSex: true, bodyValid: true, underage: false, hasActivity: true, hasGoal: true };
    expect(onboardingHint(base)).toBeNull();
    expect(onboardingHint({ ...base, hasSex: false })?.key).toBe('onboarding.hint.body');
    expect(onboardingHint({ ...base, bodyValid: false })?.key).toBe('onboarding.hint.body');
    expect(onboardingHint({ ...base, bodyValid: false, underage: true })).toBeNull();
    expect(onboardingHint({ ...base, step: 2, hasActivity: false })?.key).toBe('onboarding.hint.activity');
    expect(onboardingHint({ ...base, step: 3, hasGoal: false })?.key).toBe('onboarding.hint.goal');
    expect(onboardingHint({ ...base, step: 0, hasSex: false })).toBeNull();
    expect(read('app/onboarding.tsx')).toMatch(/testID="onboarding-hint"/);
  });
});
