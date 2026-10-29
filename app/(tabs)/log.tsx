import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import {
  parseDecimal,
  quickAddFieldErrors,
  validatePortionGrams,
  validateQuickAdd,
  type QuickAddField,
} from '@/src/lib/domain';
import { MEALS, MEAL_LABEL, addDays, friendlyDate, localDateISO, mealForHour, type Meal } from '@/src/lib/dates';
import { formatAmount, formatKcal } from '@/src/lib/format';
import { entryFromPer100 } from '@/src/lib/logging';
import { SEARCH_PAGE_SIZE, formatFiber, loadFoods, searchFoods, type Food } from '@/src/lib/foods/foods';
import { motion } from '@/src/theme/theme';
import type { LogEntry } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { MacroTokens } from '@/src/components/MacroTokens';
import { borderStrong } from '@/src/theme/extras';
import { AppText, Card, Chip, Field, PrimaryButton, Screen, SecondaryButton, useDebounced } from '@/src/components/ui';

const foods = loadFoods();

export default function LogScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const { data, addLog, updateLog, deleteLog, restoreLog } = useApp();
  const initialMeal = isMeal(params.meal) ? params.meal : mealForHour(new Date().getHours());
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [date, setDate] = useState(typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : localDateISO());
  useEffect(() => {
    if (isMeal(params.meal)) setMeal(params.meal);
    if (typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) setDate(params.date);
  }, [params.meal, params.date]);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, motion.searchDebounce);
  const [selected, setSelected] = useState<Food | null>(null);
  const [gramsText, setGramsText] = useState('100');
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [quick, setQuick] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickKcal, setQuickKcal] = useState('');
  const [quickP, setQuickP] = useState('');
  const [quickC, setQuickC] = useState('');
  const [quickF, setQuickF] = useState('');
  const [quickFiber, setQuickFiber] = useState('');
  const [quickGrams, setQuickGrams] = useState('100');
  const [formError, setFormError] = useState<string | null>(null);
  const [quickErrors, setQuickErrors] = useState<Partial<Record<QuickAddField, string>>>({});
  const [shown, setShown] = useState(SEARCH_PAGE_SIZE);
  useEffect(() => setShown(SEARCH_PAGE_SIZE), [debounced]);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [undo, setUndo] = useState<LogEntry | null>(null);

  const allResults = useMemo(() => searchFoods(foods, debounced, foods.length), [debounced]);
  const results = allResults.slice(0, shown);
  const dayEntries = data.logs.filter((entry) => entry.date === date && entry.meal === meal);

  function openFood(food: Food) {
    setEditing(null);
    setSelected(food);
    setGramsText(food.servingSizeG ? String(food.servingSizeG) : '100');
    setFormError(null);
    setQuick(false);
  }

  function openEdit(entry: LogEntry) {
    setSelected(null);
    setEditing(entry);
    setGramsText(String(entry.grams));
    setFormError(null);
  }

  async function savePortion() {
    const grams = parseDecimal(gramsText);
    const check = validatePortionGrams(grams);
    if (!check.ok || grams == null) {
      setFormError(check.message);
      return;
    }
    if (editing) {
      await updateLog(entryFromPer100({
        id: editing.id,
        name: editing.name,
        foodId: editing.foodId,
        date,
        meal,
        grams,
        kcalPer100: editing.kcalPer100,
        proteinPer100: editing.proteinPer100,
        carbsPer100: editing.carbsPer100,
        fatPer100: editing.fatPer100,
        fiberPer100: editing.fiberPer100,
      }));
      setEditing(null);
      return;
    }
    if (!selected) return;
    await addLog(entryFromPer100({
      name: selected.name,
      foodId: selected.id,
      date,
      meal,
      grams,
      kcalPer100: selected.kcalPer100g,
      proteinPer100: selected.proteinPer100g,
      carbsPer100: selected.carbsPer100g,
      fatPer100: selected.fatPer100g,
      fiberPer100: selected.fiberPer100g,
    }));
    setSelected(null);
  }

  async function saveQuick() {
    const fiberText = quickFiber.trim();
    const input = {
      name: quickName,
      kcal: parseDecimal(quickKcal),
      proteinG: parseDecimal(quickP),
      carbsG: parseDecimal(quickC),
      fatG: parseDecimal(quickF),
      fiberG: fiberText === '' ? null : parseDecimal(fiberText),
      grams: parseDecimal(quickGrams),
    };
    const errors = quickAddFieldErrors(input);
    if (fiberText !== '' && input.fiberG == null) errors.fiberG = 'Enter fiber as a number, or leave it blank if you do not know it.';
    if (Object.keys(errors).length > 0) {
      setQuickErrors(errors);
      setFormError(null);
      setMismatch(null);
      return;
    }
    const review = validateQuickAdd(input);
    if (review.issues.length > 0 || input.kcal == null || input.proteinG == null || input.carbsG == null || input.fatG == null || input.grams == null) {
      setFormError(review.issues[0] ?? 'Check the quick add fields.');
      setMismatch(null);
      return;
    }
    setQuickErrors({});
    setMismatch(review.mismatch);
    const per100 = 100 / input.grams;
    await addLog(entryFromPer100({
      name: input.name,
      foodId: null,
      date,
      meal,
      grams: input.grams,
      kcalPer100: input.kcal * per100,
      proteinPer100: input.proteinG * per100,
      carbsPer100: input.carbsG * per100,
      fatPer100: input.fatG * per100,
      fiberPer100: input.fiberG == null ? null : input.fiberG * per100,
    }));
    setQuickName('');
    setQuickKcal('');
    setQuickP('');
    setQuickC('');
    setQuickF('');
    setQuickFiber('');
    setFormError(null);
    setQuick(false);
  }

  async function remove(entry: LogEntry) {
    const removed = await deleteLog(entry.id);
    if (!removed) return;
    setUndo(removed);
    setTimeout(() => setUndo((current) => (current?.id === removed.id ? null : current)), motion.toast);
  }

  const preview = selected
    ? scalePreview(selected.kcalPer100g, selected.proteinPer100g, selected.carbsPer100g, selected.fatPer100g, selected.fiberPer100g, parseDecimal(gramsText))
    : editing
      ? scalePreview(editing.kcalPer100, editing.proteinPer100, editing.carbsPer100, editing.fatPer100, editing.fiberPer100, parseDecimal(gramsText))
      : null;

  const dayButtonStyle = {
    width: theme.sizes.minTouchTarget,
    height: theme.sizes.minTouchTarget,
    borderRadius: theme.sizes.minTouchTarget / 2,
    borderWidth: 1,
    borderColor: borderStrong(theme),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <Screen testID="screen-log">
      <AppText variant="title">Log</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {MEALS.map((option) => (
          <Chip key={option} label={MEAL_LABEL[option]} selected={meal === option} onPress={() => setMeal(option)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate((value) => addDays(value, -1))} style={dayButtonStyle}>
          <ChevronLeft color={theme.colors.primary} size={22} strokeWidth={2.2} />
        </Pressable>
        <AppText variant="bodyMedium">{friendlyDate(date)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => setDate((value) => addDays(value, 1))} style={dayButtonStyle}>
          <ChevronRight color={theme.colors.primary} size={22} strokeWidth={2.2} />
        </Pressable>
      </View>

      <Field label="Search foods" accessibilityLabel="Search foods" value={query} onChangeText={setQuery} keyboard="default" placeholder="Try baked bacon" />

      {selected || editing ? (
        <Card style={{ gap: theme.spacing.md }}>
          <AppText variant="section">{editing ? editing.name : selected?.name}</AppText>
          <AppText variant="caption" color={theme.colors.textSecondary}>
            {editing ? 'Editing this entry' : `${formatAmount(selected?.kcalPer100g ?? 0, 0)} kcal per 100 g`}
            {selected?.servingLabel && selected.servingSizeG ? ` · ${selected.servingLabel} (${formatAmount(selected.servingSizeG)} g)` : ''}
          </AppText>
          <Field label="Grams" value={gramsText} onChangeText={setGramsText} suffix="g" error={formError} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {selected?.servingSizeG ? (
              <Chip label={selected.servingLabel ?? 'Serving'} detail={`${formatAmount(selected.servingSizeG)} g`} selected={gramsText === String(selected.servingSizeG)} onPress={() => setGramsText(String(selected.servingSizeG))} />
            ) : null}
            {[50, 100, 150, 200].map((grams) => (
              <Chip key={grams} label={`${grams} g`} selected={gramsText === String(grams) && gramsText !== String(selected?.servingSizeG ?? '')} onPress={() => setGramsText(String(grams))} />
            ))}
          </View>
          {preview ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="bodyMedium">{formatKcal(preview.kcal)} kcal</AppText>
              <MacroTokens protein={preview.protein} carbs={preview.carbs} fat={preview.fat} />
              <AppText variant="caption" color={theme.colors.textSecondary}>Fiber {formatFiber(preview.fiber)} g</AppText>
            </View>
          ) : null}
          <PrimaryButton label={editing ? 'Save changes' : `Add to ${MEAL_LABEL[meal]}`} onPress={savePortion} testID="add-food" />
          <SecondaryButton label="Cancel" onPress={() => { setSelected(null); setEditing(null); setFormError(null); }} />
        </Card>
      ) : null}

      <Chip label={quick ? 'Hide quick add' : 'Quick add'} selected={quick} onPress={() => { setQuick((value) => !value); setSelected(null); setEditing(null); }} />
      {quick ? (
        <Card style={{ gap: theme.spacing.md }}>
          <AppText variant="section">Quick add</AppText>
          <Field label="Name" value={quickName} onChangeText={setQuickName} error={quickErrors.name} keyboard="default" placeholder="Phở bò" />
          <Field label="Calories" value={quickKcal} onChangeText={setQuickKcal} error={quickErrors.kcal} suffix="kcal" />
          <Field label="Protein" value={quickP} onChangeText={setQuickP} error={quickErrors.proteinG} labelColor={theme.macroColors.protein} suffix="g" />
          <Field label="Carbs" value={quickC} onChangeText={setQuickC} error={quickErrors.carbsG} labelColor={theme.macroColors.carbs} suffix="g" />
          <Field label="Fat" value={quickF} onChangeText={setQuickF} error={quickErrors.fatG} labelColor={theme.macroColors.fat} suffix="g" />
          <Field label="Fiber (blank if unknown)" value={quickFiber} onChangeText={setQuickFiber} error={quickErrors.fiberG} suffix="g" />
          <Field label="Portion" value={quickGrams} onChangeText={setQuickGrams} error={quickErrors.grams} suffix="g" />
          {formError ? <AppText variant="caption" color={theme.colors.warningText}>{formError}</AppText> : null}
          {mismatch ? <AppText variant="caption" color={theme.colors.warningText}>{mismatch}</AppText> : null}
          <PrimaryButton label="Save quick add" onPress={saveQuick} />
        </Card>
      ) : null}

      {debounced.trim() ? (
        <View style={{ gap: theme.spacing.sm }}>
          {results.length === 0 ? <AppText variant="secondary" color={theme.colors.textSecondary}>No foods match that search.</AppText> : null}
          {results.map((food) => (
            <Pressable key={food.id} onPress={() => openFood(food)} accessibilityRole="button" accessibilityLabel={`${food.name}, ${formatKcal(food.kcalPer100g)} kcal per 100 grams. Add`} style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
              flexDirection: 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}>
              <View style={{ width: theme.sizes.thumbnail, height: theme.sizes.thumbnail, borderRadius: theme.radii.thumbnail, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="bodyMedium" color={theme.colors.primary}>{food.name.slice(0, 1)}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText>{food.name}</AppText>
                <AppText variant="caption" color={theme.colors.textSecondary}>
                  {formatKcal(food.kcalPer100g)} kcal / 100 g · P {formatAmount(food.proteinPer100g)} · C {formatAmount(food.carbsPer100g)} · F {formatAmount(food.fatPer100g)} · fiber {formatFiber(food.fiberPer100g)}
                </AppText>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Plus color={theme.colors.onAccent} size={18} strokeWidth={2.4} />
              </View>
            </Pressable>
          ))}
          {allResults.length > results.length ? (
            <SecondaryButton label={`Show more (${allResults.length - results.length} more)`} onPress={() => setShown((value) => value + SEARCH_PAGE_SIZE)} />
          ) : null}
        </View>
      ) : (
        <AppText variant="secondary" color={theme.colors.textSecondary}>
          Search {foods.length} foods. USDA names work in any order, so “baked bacon” finds “Bacon, baked”.
        </AppText>
      )}

      <AppText variant="section">{MEAL_LABEL[meal]} · {friendlyDate(date)}</AppText>
      {dayEntries.length === 0 ? <AppText variant="secondary" color={theme.colors.textSecondary}>Nothing in this meal yet.</AppText> : null}
      {dayEntries.map((entry) => (
        <Card key={entry.id}>
          <AppText>{entry.name}</AppText>
          <AppText variant="caption" color={theme.colors.textSecondary}>
            {formatAmount(entry.grams)} g · {formatKcal(entry.kcal)} kcal · fiber {formatFiber(entry.fiberG)}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <SecondaryButton label="Edit" onPress={() => openEdit(entry)} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.name}`} onPress={() => remove(entry)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
              <Trash2 color={theme.colors.warningText} size={20} />
            </Pressable>
          </View>
        </Card>
      ))}
      {undo ? (
        <Card>
          <AppText>Removed {undo.name}.</AppText>
          <SecondaryButton label="Undo" onPress={async () => { await restoreLog(undo); setUndo(null); }} />
        </Card>
      ) : null}
    </Screen>
  );
}

function isMeal(value: string | undefined): value is Meal {
  return !!value && (MEALS as string[]).includes(value);
}

function scalePreview(kcal: number, protein: number, carbs: number, fat: number, fiber: number | null, grams: number | null) {
  if (grams == null) return null;
  const scale = grams / 100;
  return {
    kcal: kcal * scale,
    protein: protein * scale,
    carbs: carbs * scale,
    fat: fat * scale,
    fiber: fiber == null ? null : fiber * scale,
  };
}
