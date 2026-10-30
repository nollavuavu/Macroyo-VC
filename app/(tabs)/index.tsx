import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Drumstick, Droplets, Plus, Wheat } from 'lucide-react-native';
import { borderStrong } from '@/src/theme/extras';
import { progressRatio, roundToSum, sumLogged } from '@/src/lib/domain';
import { MEALS, MEAL_KEY, addDays, dayAccessibilityLabel, formatLongDate, weekDates, weekdayNarrow, type Meal } from '@/src/lib/dates';
import { NBSP, formatAmount, formatKcal, formatPercent, withUnit } from '@/src/lib/format';
import { formatFiber } from '@/src/lib/foods/foods';
import type { LogEntry } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';
import { msg } from '@/src/i18n/msg';
import type { Msg } from '@/src/i18n/types';
import { AppText, Card, ProgressTrack, Screen, SecondaryButton } from '@/src/components/ui';
import { CalorieRing } from '@/src/components/Ring';
import { borders, fabGeometry, icons, marks, strokes } from '@/src/theme/extras';

const MACRO_ICON = {
  protein: Drumstick,
  carbs: Wheat,
  fat: Droplets,
} as const;

export default function TodayScreen() {
  const theme = useTheme();
  const { t, tm } = useI18n();
  const { data, addLog, selectedDate: date, setSelectedDate: setDate } = useApp();
  const profile = data.profile;
  const [toast, setToast] = useState<Msg | null>(null);
  const entries = data.logs.filter((entry) => entry.date === date);
  const totals = sumLogged(entries);
  const week = weekDates(date);
  const targets = profile?.targets;

  const grouped = useMemo(() => {
    const map = new Map<Meal, LogEntry[]>();
    for (const meal of MEALS) map.set(meal, []);
    for (const entry of entries) map.get(entry.meal)?.push(entry);
    return map;
  }, [entries]);

  // Round once, from the same values: item rows add up to meal subtotals, and subtotals to the day total.
  const kcalDisplay = useMemo(() => {
    const ordered = MEALS.flatMap((meal) => grouped.get(meal) ?? []);
    const { rounded, total } = roundToSum(ordered.map((entry) => entry.kcal));
    const byId = new Map<string, number>();
    ordered.forEach((entry, index) => byId.set(entry.id, rounded[index]));
    return { byId, total };
  }, [grouped]);

  async function copyYesterday() {
    const previous = data.logs.filter((entry) => entry.date === addDays(date, -1));
    for (const entry of previous) {
      const { id: _id, ...rest } = entry;
      await addLog({ ...rest, id: `${entry.id}-copy-${date}-${Math.random().toString(36).slice(2, 6)}`, date });
    }
    setToast(msg('today.copied', { count: previous.length }));
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="screen-today" fabClearance>
        <View>
          <AppText variant="title">{t('today.title')}</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>{formatLongDate(date)}</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map((iso) => {
            const selected = iso === date;
            const dayCount = data.logs.filter((entry) => entry.date === iso).length;
            const hasLogs = dayCount > 0;
            return (
              <Pressable
                key={iso}
                onPress={() => setDate(iso)}
                accessibilityRole="button"
                accessibilityLabel={dayAccessibilityLabel(iso, dayCount)}
                accessibilityState={{ selected }}
                style={{ alignItems: 'center', gap: theme.spacing.xs, minWidth: theme.sizes.minTouchTarget, minHeight: theme.sizes.minTouchTarget + 20 }}
              >
                <AppText variant="caption" color={theme.colors.textSecondary}>{weekdayNarrow(iso)}</AppText>
                <View style={{
                  width: theme.sizes.minTouchTarget,
                  height: theme.sizes.minTouchTarget,
                  borderRadius: theme.sizes.minTouchTarget / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.colors.primary : 'transparent',
                }}>
                  <AppText variant="bodyMedium" color={selected ? theme.colors.onPrimary : theme.colors.textPrimary}>
                    {Number(iso.slice(-2))}
                  </AppText>
                </View>
                <View style={{ width: marks.dotSmall, height: marks.dotSmall, borderRadius: marks.dotSmall / 2, backgroundColor: hasLogs ? theme.colors.primary : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>

        <Card>
          <CalorieRing consumed={kcalDisplay.total} target={targets?.kcal ?? 0} />
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          {(['protein', 'carbs', 'fat'] as const).map((key) => {
            const consumed = key === 'protein' ? totals.proteinG : key === 'carbs' ? totals.carbsG : totals.fatG;
            const target = key === 'protein' ? targets?.proteinG ?? 0 : key === 'carbs' ? targets?.carbsG ?? 0 : targets?.fatG ?? 0;
            const Icon = MACRO_ICON[key];
            const fill = theme.macroColors[key];
            const text = theme.macroTextColors[key];
            const ratio = progressRatio(consumed, target);
            return (
              <View key={key} style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Icon color={fill} size={icons.sm} strokeWidth={strokes.regular} />
                  <AppText variant="bodyMedium" style={{ flex: 1 }}>{t(`macro.${key}`)}</AppText>
                  <AppText variant="macroGrams" color={text}>{`${formatAmount(consumed, 0)} / ${withUnit(formatAmount(target, 0), 'g')}${target > 0 ? `${NBSP}· ${formatPercent(ratio)}` : ''}`}</AppText>
                </View>
                <ProgressTrack ratio={ratio} color={fill} />
              </View>
            );
          })}
          <AppText variant="caption" color={theme.colors.textSecondary}>
            {t('today.fiber', { fiber: formatFiber(totals.fiberG) })}{totals.fiberG == null && entries.length > 0 ? ` · ${t('today.fiberUnknown')}` : ''}
          </AppText>
        </Card>

        {entries.length === 0 ? (
          <Card style={{ gap: theme.spacing.md, alignItems: 'center' }}>
            <Image
              source={require('../../assets/icon-small.png')}
              accessibilityIgnoresInvertColors
              style={{ width: marks.emptyMark, height: marks.emptyMark, borderRadius: marks.emptyMark / 4, opacity: 0.9 }}
            />
            <AppText variant="section">{t('today.emptyTitle')}</AppText>
            <AppText variant="secondary" color={theme.colors.textSecondary} style={{ textAlign: 'center' }}>
              {t('today.emptyBody')}
            </AppText>
            <SecondaryButton label={t('today.logMeal')} onPress={() => router.push({ pathname: '/log', params: { date } })} />
            {data.logs.some((entry) => entry.date === addDays(date, -1)) ? (
              <SecondaryButton label={t('today.copyYesterday')} onPress={copyYesterday} />
            ) : null}
          </Card>
        ) : (
          MEALS.map((meal) => {
            const items = grouped.get(meal) ?? [];
            const subtotal = items.reduce((sum, item) => sum + (kcalDisplay.byId.get(item.id) ?? 0), 0);
            return (
              <Card key={meal} style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: theme.sizes.minTouchTarget }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="section">{t(MEAL_KEY[meal])}</AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary}>{withUnit(formatKcal(subtotal), 'kcal')}</AppText>
                  </View>
                </View>
                {items.map((item) => (
                  <View key={item.id} style={{ paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                    <AppText>{item.name}</AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary}>
                      {t('today.itemDetail', { grams: formatAmount(item.grams), kcal: formatKcal(kcalDisplay.byId.get(item.id) ?? item.kcal), p: formatAmount(item.proteinG), c: formatAmount(item.carbsG), f: formatAmount(item.fatG), fiber: formatFiber(item.fiberG) })}
                    </AppText>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('log.addTo', { meal: t(MEAL_KEY[meal]) })}
                  onPress={() => router.push({ pathname: '/log', params: { meal, date } })}
                  style={{
                    position: 'absolute',
                    top: theme.spacing.md,
                    right: theme.spacing.md,
                    width: theme.sizes.minTouchTarget,
                    height: theme.sizes.minTouchTarget,
                    borderRadius: theme.sizes.minTouchTarget / 2,
                    borderWidth: borders.thin,
                    borderColor: borderStrong(theme),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus color={theme.colors.primary} size={icons.md} strokeWidth={strokes.bold} />
                </Pressable>
              </Card>
            );
          })
        )}
        {toast ? <AppText variant="caption" color={theme.colors.primary}>{tm(toast)}</AppText> : null}
      </Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('today.logFood')}
        onPress={() => router.push({ pathname: '/log', params: { date } })}
        style={{
          position: 'absolute',
          right: theme.spacing.lg,
          bottom: fabGeometry(theme).bottom,
          width: theme.sizes.fab,
          height: theme.sizes.fab,
          borderRadius: theme.sizes.fab / 2,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.floating,
        }}
      >
        <Plus color={theme.colors.onAccent} size={icons.fab} strokeWidth={strokes.bold} />
      </Pressable>
    </View>
  );
}
