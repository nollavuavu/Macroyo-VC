import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Drumstick, Droplets, Plus, Wheat } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { progressRatio, sumLogged } from '@/src/lib/domain';
import { MEALS, MEAL_LABEL, addDays, formatLongDate, localDateISO, weekDates, type Meal } from '@/src/lib/dates';
import { formatAmount, formatKcal } from '@/src/lib/format';
import { formatFiber } from '@/src/lib/foods/foods';
import type { LogEntry } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, PrimaryButton, ProgressTrack, Screen, SecondaryButton } from '@/src/components/ui';
import { CalorieRing } from '@/src/components/Ring';

const MACRO_ICON = {
  protein: Drumstick,
  carbs: Wheat,
  fat: Droplets,
} as const;

export default function TodayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, addLog } = useApp();
  const profile = data.profile;
  const [date, setDate] = useState(localDateISO());
  const [toast, setToast] = useState<string | null>(null);
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

  async function copyYesterday() {
    const previous = data.logs.filter((entry) => entry.date === addDays(date, -1));
    for (const entry of previous) {
      const { id: _id, ...rest } = entry;
      await addLog({ ...rest, id: `${entry.id}-copy-${date}-${Math.random().toString(36).slice(2, 6)}`, date });
    }
    setToast(`Copied ${previous.length} item${previous.length === 1 ? '' : 's'} from yesterday.`);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="screen-today">
        <View>
          <AppText variant="title">Today</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>{formatLongDate(date)}</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map((iso) => {
            const selected = iso === date;
            const hasLogs = data.logs.some((entry) => entry.date === iso);
            return (
              <Pressable key={iso} onPress={() => setDate(iso)} accessibilityRole="button" style={{ alignItems: 'center', gap: 4, minWidth: 36 }}>
                <AppText variant="caption" color={theme.colors.textSecondary}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][week.indexOf(iso)]}</AppText>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.colors.primary : 'transparent',
                }}>
                  <AppText variant="bodyMedium" color={selected ? theme.colors.onPrimary : theme.colors.textPrimary}>
                    {Number(iso.slice(-2))}
                  </AppText>
                </View>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasLogs ? theme.colors.primary : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>

        <Card>
          <CalorieRing consumed={totals.kcal} target={targets?.kcal ?? 0} />
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
              <View key={key} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon color={fill} size={18} strokeWidth={2} />
                  <AppText variant="bodyMedium" style={{ flex: 1, textTransform: 'capitalize' }}>{key}</AppText>
                  <AppText variant="macroGrams" color={text}>{formatAmount(consumed)} / {formatAmount(target)} g</AppText>
                </View>
                <ProgressTrack ratio={ratio} color={fill} />
                <AppText variant="caption" color={theme.colors.textSecondary}>
                  {target > 0 ? `${Math.round(ratio * 100)}%` : '—'}
                </AppText>
              </View>
            );
          })}
          <AppText variant="caption" color={theme.colors.textSecondary}>
            Fiber {formatFiber(totals.fiberG)}{totals.fiberG == null && entries.length > 0 ? ' · not listed for every food' : ''}
          </AppText>
        </Card>

        {entries.length === 0 ? (
          <Card style={{ gap: theme.spacing.md }}>
            <AppText variant="section">Nothing logged yet</AppText>
            <AppText variant="secondary" color={theme.colors.textSecondary}>
              Add a meal and it will show up here, grouped by breakfast, lunch, dinner, and snack.
            </AppText>
            <PrimaryButton label="Log a meal" onPress={() => router.push({ pathname: '/log', params: { date } })} />
            {data.logs.some((entry) => entry.date === addDays(date, -1)) ? (
              <SecondaryButton label="Copy yesterday" onPress={copyYesterday} />
            ) : null}
          </Card>
        ) : (
          MEALS.map((meal) => {
            const items = grouped.get(meal) ?? [];
            const subtotal = items.reduce((sum, item) => sum + item.kcal, 0);
            return (
              <Card key={meal} style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="section">{MEAL_LABEL[meal]}</AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary}>{formatKcal(subtotal)} kcal</AppText>
                  </View>
                </View>
                {items.map((item) => (
                  <View key={item.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                    <AppText>{item.name}</AppText>
                    <AppText variant="caption" color={theme.colors.textSecondary}>
                      {formatAmount(item.grams)} g · {formatKcal(item.kcal)} kcal · P {formatAmount(item.proteinG)} · C {formatAmount(item.carbsG)} · F {formatAmount(item.fatG)} · fiber {formatFiber(item.fiberG)}
                    </AppText>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add to ${MEAL_LABEL[meal]}`}
                  onPress={() => router.push({ pathname: '/log', params: { meal, date } })}
                  style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText variant="bodyMedium" color={theme.colors.onAccent}>Add</AppText>
                </Pressable>
              </Card>
            );
          })
        )}
        {toast ? <AppText variant="caption" color={theme.colors.primary}>{toast}</AppText> : null}
      </Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log food"
        onPress={() => router.push({ pathname: '/log', params: { date } })}
        style={{
          position: 'absolute',
          right: theme.spacing.lg,
          bottom: insets.bottom + theme.sizes.tabBarHeight + theme.spacing.md,
          width: theme.sizes.fab,
          height: theme.sizes.fab,
          borderRadius: theme.sizes.fab / 2,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.floating,
        }}
      >
        <Plus color={theme.colors.onAccent} size={28} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}
