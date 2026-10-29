import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  bindingLimit,
  bmiCategory,
  bmiMetric,
  buildMacroPlan,
  parseCustomOffset,
  type BmrFormula,
  type SexConstantChoice,
  ffmiValue,
  interpretFfmi,
  leanMassKg,
  normalizedFfmi,
  parseDecimal,
  projectV1,
  validateBodyFat,
  validateHeightCm,
  validateWeightKg,
  validateTypedMeasure,
  DEFICIT_UNAVAILABLE_MESSAGE,
  horizonMsg,
  type ActivityLevel,
  type Sex,
} from '@/src/lib/domain';
import { ACTIVITY_DETAILS, ACTIVITY_FACTORS, bmiTone } from '@/src/lib/domain';
import { localDateISO, uid } from '@/src/lib/dates';
import { NBSP, formatAmount, formatFixed, formatInputNumber, formatKcal, formatSigned, withUnit } from '@/src/lib/format';
import { useI18n } from '@/src/i18n/react';
import type { Msg } from '@/src/i18n/types';
import { msg } from '@/src/i18n/msg';
import { useApp, useTheme } from '@/src/state/AppContext';
import { FormulaPicker, SexConstantPicker } from '@/src/components/BmrChoices';
import { AppText, Card, Chip, Disclaimer, Field, GroupLabel, PrimaryButton, Screen, Segmented } from '@/src/components/ui';

type Mode = 'bmi' | 'ffmi' | 'calories';
type Direction = 'deficit' | 'surplus';

const PRESETS = [100, 250, 500, 750, 1000];

export default function CalcScreen() {
  const theme = useTheme();
  const { t, tm } = useI18n();
  const { data, addBodyStat } = useApp();
  const profile = data.profile;
  const [mode, setMode] = useState<Mode>('bmi');
  const [units, setUnits] = useState<'metric' | 'imperial'>(profile?.units ?? 'metric');
  const [heightCm, setHeightCm] = useState(profile?.heightCm ?? 170);
  const [weightKg, setWeightKg] = useState(profile?.weightKg ?? 70);
  const [bodyFat, setBodyFat] = useState<number | null>(profile?.bodyFatPct ?? null);
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [age, setAge] = useState(profile?.age ?? 30);
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity ?? 'moderate');
  const [toggleDirection, setDirection] = useState<Direction>('deficit');
  const [formulaOverride, setFormulaOverride] = useState<BmrFormula | null>(profile?.formulaOverride ?? null);
  const [sexConstant, setSexConstant] = useState<SexConstantChoice | null>(profile?.sexConstant ?? null);
  const [preset, setPreset] = useState<number | null>(250);
  const [customText, setCustomText] = useState('');
  const [savedNote, setSavedNote] = useState<Msg | null>(null);
  // Typed text per box. null = untouched. Validation reads this raw text, never the clamped state behind it.
  const [heightText, setHeightText] = useState<string | null>(null);
  const [weightText, setWeightText] = useState<string | null>(null);
  const [ageText, setAgeText] = useState<string | null>(null);
  const typedHeight = heightText == null ? null : validateTypedMeasure('height', heightText, units);
  const typedWeight = weightText == null ? null : validateTypedMeasure('weight', weightText, units);
  const typedAge = ageText == null ? null : validateTypedMeasure('age', ageText, units);
  const typedInvalid = [typedHeight, typedWeight, typedAge].some((typed) => typed != null && !typed.ok);

  const heightError = typedHeight?.message ?? validateHeightCm(heightCm).message;
  const weightError = typedWeight?.message ?? validateWeightKg(weightKg).message;
  const fatError = bodyFat == null ? null : validateBodyFat(bodyFat).message;
  const bmi = bmiMetric(weightKg, heightCm);
  const bmiClass = bmi == null ? null : bmiCategory(bmi);
  const lean = bodyFat == null ? null : leanMassKg(weightKg, bodyFat);
  const ffmi = lean == null ? null : ffmiValue(lean, heightCm);
  const nffmi = ffmi == null ? null : normalizedFfmi(ffmi, heightCm);
  const ffmiReading = nffmi == null ? null : interpretFfmi(sex, nffmi);

  // One resolved formula for Calc, Profile and onboarding: the user's override, else Katch when body fat is entered.
  const plan = useMemo(
    () => buildMacroPlan({ sex, age, heightCm, weightKg, bodyFatPct: bodyFat, activity, goal: 'maintain', formula: formulaOverride ?? undefined, sexConstant }),
    [activity, age, bodyFat, formulaOverride, heightCm, sex, sexConstant, weightKg],
  );
  const projectionBase = {
    weight_kg: weightKg,
    height_cm: heightCm,
    age,
    sex: plan.mifflinSex,
    activity_factor: ACTIVITY_FACTORS[activity],
    tdee_override_kcal: plan.tdee,
    floor_kcal: plan.calorieFloor,
  };
  const bmrPreview = useMemo(
    () => projectV1({ ...projectionBase, daily_offset_kcal: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, age, heightCm, plan.calorieFloor, plan.mifflinSex, plan.tdee, weightKg],
  );

  const cap = bmrPreview.max_safe_offset_kcal;
  const parsedCustom = parseCustomOffset(customText, toggleDirection);
  // An explicit sign in the custom field wins over the toggle; otherwise the toggle decides.
  const direction: Direction = customText.trim() && parsedCustom.valid ? parsedCustom.direction : toggleDirection;
  const presetAllowed = preset != null && !(direction === 'deficit' && (bmrPreview.deficit_unavailable || preset > cap + 1e-9));
  const magnitude = customText.trim() ? parsedCustom.magnitude : presetAllowed && preset != null ? preset : 0;
  const requested = magnitude * (direction === 'deficit' ? -1 : 1);

  const projection = useMemo(() => {
    if (mode !== 'calories') return null;
    return projectV1({
      ...projectionBase,
      daily_offset_kcal: direction === 'deficit' && bmrPreview.deficit_unavailable ? 0 : requested,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, age, bmrPreview.deficit_unavailable, direction, heightCm, mode, plan.calorieFloor, plan.mifflinSex, plan.tdee, requested, weightKg]);

  const binding = bindingLimit(bmrPreview.max_safe_offset_components, cap);

  async function saveStat() {
    if (typedInvalid || bmi == null || heightError || weightError || fatError) return;
    const ok = await addBodyStat({
      id: uid(),
      date: localDateISO(),
      weightKg,
      heightCm,
      bodyFatPct: bodyFat,
      bmi,
      ffmi,
      normalizedFfmi: nffmi,
    });
    setSavedNote(ok ? msg('calc.saved') : null);
  }

  return (
    <Screen testID="screen-calc">
      <AppText variant="title">{t('calc.title')}</AppText>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'bmi', label: t('calc.mode.bmi') },
          { value: 'ffmi', label: t('calc.mode.ffmi') },
          { value: 'calories', label: t('calc.mode.calories') },
        ]}
      />
      <Segmented
        value={units}
        onChange={(value) => { setUnits(value); setHeightText(null); setWeightText(null); }}
        options={[{ value: 'metric', label: t('units.metric') }, { value: 'imperial', label: t('units.imperial') }]}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.height')}</AppText>
        <AppText variant="inputNumber">{units === 'metric' ? withUnit(formatAmount(heightCm), 'cm') : withUnit(formatAmount(heightCm / 2.54), 'in')}</AppText>
        <Slider minimumValue={120} maximumValue={230} value={heightCm} onValueChange={(value) => { setHeightCm(value); setHeightText(null); }} minimumTrackTintColor={theme.colors.primary} maximumTrackTintColor={theme.colors.border} thumbTintColor={theme.colors.primary} />
        <Field label={t('calc.typeHeight')} value={heightText ?? ''} onChangeText={(value) => {
          setHeightText(value);
          const typed = validateTypedMeasure('height', value, units);
          if (typed.ok && typed.value != null) setHeightCm(typed.value);
        }} suffix={units === 'metric' ? 'cm' : 'in'} error={heightError ? tm(heightError) : null} />
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.weight')}</AppText>
        <AppText variant="inputNumber">{units === 'metric' ? withUnit(formatAmount(weightKg), 'kg') : withUnit(formatAmount(weightKg / 0.45359237), 'lb')}</AppText>
        <Slider minimumValue={30} maximumValue={250} value={Math.min(250, Math.max(30, weightKg))} onValueChange={(value) => { setWeightKg(value); setWeightText(null); }} minimumTrackTintColor={theme.colors.primary} maximumTrackTintColor={theme.colors.border} thumbTintColor={theme.colors.primary} />
        <Field label={t('calc.typeWeight')} value={weightText ?? ''} onChangeText={(value) => {
          setWeightText(value);
          const typed = validateTypedMeasure('weight', value, units);
          if (typed.ok && typed.value != null) setWeightKg(typed.value);
        }} suffix={units === 'metric' ? 'kg' : 'lb'} error={weightError ? tm(weightError) : null} />
      </Card>

      {mode === 'ffmi' || mode === 'calories' ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.bodyFat')}</AppText>
          <AppText variant="inputNumber">{bodyFat == null ? '—' : withUnit(formatAmount(bodyFat), '%')}</AppText>
          <Slider
            minimumValue={3}
            maximumValue={60}
            value={bodyFat ?? 20}
            onValueChange={(value) => setBodyFat(Math.round(value * 10) / 10)}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.primary}
          />
          {fatError ? <AppText variant="caption" color={theme.colors.warningText}>{tm(fatError)}</AppText> : null}
          <Chip label={t('calc.notSure')} selected={bodyFat == null} onPress={() => setBodyFat(null)} />
        </Card>
      ) : null}

      {typedInvalid ? (
        <Card>
          <AppText variant="secondary" color={theme.colors.warningText} accessibilityRole="alert">{t('calc.fixEntry')}</AppText>
        </Card>
      ) : null}

      {!typedInvalid && mode === 'bmi' && bmi != null && bmiClass ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="metricNumber">{formatFixed(bmi, 1)}</AppText>
          <AppText variant="section" color={bmiTone(bmi) === 'success' ? theme.colors.successText : theme.colors.warningText}>{tm(bmiClass.label)}</AppText>
          {bmiClass.detail ? <AppText variant="secondary" color={theme.colors.textSecondary}>{tm(bmiClass.detail)}</AppText> : null}
          <AppText variant="caption" color={theme.colors.textSecondary}>{t('calc.bmi.note')}</AppText>
        </Card>
      ) : null}

      {!typedInvalid && mode === 'ffmi' ? (
        <Card style={{ gap: theme.spacing.sm }}>
          {bodyFat == null || ffmi == null || nffmi == null || !ffmiReading ? (
            <AppText>{t('calc.ffmi.enterBodyFat')}</AppText>
          ) : (
            <>
              <AppText variant="caption" color={theme.colors.textSecondary}>{t('calc.mode.ffmi')}</AppText>
              <AppText variant="metricNumber">{formatFixed(ffmi, 1)}</AppText>
              <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.ffmi.normalized', { value: formatFixed(nffmi, 1) })}</AppText>
              <AppText variant="section" color={theme.colors.primary}>{tm(ffmiReading.label)}</AppText>
              <AppText variant="caption" color={theme.colors.textSecondary}>{tm(ffmiReading.detail)}</AppText>
              {sex !== 'male' ? (
                <AppText variant="caption" color={theme.colors.textSecondary}>{t('calc.ffmi.maleReference')}</AppText>
              ) : null}
              <AppText variant="caption" color={theme.colors.textSecondary}>
                {t('calc.ffmi.formula', { lean: formatAmount(lean ?? 0) })}
              </AppText>
            </>
          )}
        </Card>
      ) : null}

      {mode === 'calories' && projection ? (
        <View style={{ gap: theme.spacing.md }}>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.maintenance')}</AppText>
            <AppText variant="metricNumber">{typedInvalid ? '—' : formatKcal(projection.tdee_kcal)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {t('calc.estimateBmr', { bmr: typedInvalid ? '—' : formatKcal(plan.bmr) })}
            </AppText>
            <FormulaPicker plan={plan} bodyFatEntered={bodyFat != null} onChange={setFormulaOverride} />
            <GroupLabel>{t('common.sex')}</GroupLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(['female', 'male', 'unspecified'] as Sex[]).map((option) => (
                <Chip key={option} label={t(`sex.${option}`)} selected={sex === option} onPress={() => setSex(option)} />
              ))}
            </View>
            <SexConstantPicker sex={sex} value={sexConstant} onChange={setSexConstant} />
            <Field label={t('common.age')} value={ageText ?? formatInputNumber(age)} onChangeText={(value) => {
              setAgeText(value);
              const typed = validateTypedMeasure('age', value, units);
              if (typed.ok && typed.value != null) setAge(typed.value);
            }} error={typedAge?.message ? tm(typedAge.message) : null} suffix={t('unit.years')} keyboard="number" />
            <GroupLabel>{t('calc.activityLevel')}</GroupLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((level) => (
                <Chip
                  key={level}
                  label={tm(ACTIVITY_DETAILS[level].label)}
                  detail={tm(ACTIVITY_DETAILS[level].description)}
                  selected={activity === level}
                  onPress={() => setActivity(level)}
                />
              ))}
            </View>
          </Card>
          {typedInvalid ? null : (
            <>
          <Segmented
            value={direction}
            onChange={(value) => { setDirection(value); setCustomText(''); }}
            options={[
              { value: 'deficit', label: t('calc.deficit'), disabled: projection.deficit_unavailable },
              { value: 'surplus', label: t('calc.surplus') },
            ]}
          />
          {projection.deficit_unavailable ? (
            <AppText variant="secondary" color={theme.colors.warningText}>
              {tm(DEFICIT_UNAVAILABLE_MESSAGE)}
            </AppText>
          ) : (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {t('calc.maxDeficit', { cap: formatAmount(cap), limit: tm(binding) })}
            </AppText>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {PRESETS.map((value) => {
              const disabled = direction === 'deficit' && (projection.deficit_unavailable || value > cap + 1e-9);
              return (
                <Chip
                  key={value}
                  label={`${value}`}
                  selected={!customText && preset === value && !disabled}
                  disabled={disabled}
                  onPress={() => { setPreset(value); setCustomText(''); }}
                />
              );
            })}
          </View>
          <Field
            label={t('calc.customLabel')}
            value={customText}
            onChangeText={setCustomText}
            placeholder={t('calc.customPlaceholder')}
          />
          {customText.trim() && !parsedCustom.valid ? (
            <AppText variant="caption" color={theme.colors.warningText}>
              {t('calc.customInvalid', { message: parsedCustom.message ? tm(parsedCustom.message) : '' })}
            </AppText>
          ) : null}
          {direction === 'deficit' && !projection.deficit_unavailable && customText && parsedCustom.valid && parsedCustom.magnitude > cap ? (
            <AppText variant="caption" color={theme.colors.warningText}>
              {t('calc.capApplied', { cap: formatAmount(cap) })}
            </AppText>
          ) : null}
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="secondary" color={theme.colors.textSecondary}>{t('calc.targetIntake')}</AppText>
            <AppText variant="metricNumber">{formatKcal(projection.target_kcal)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {t('calc.effectiveOffset', { offset: formatSigned(projection.effective_offset_kcal, 0), pct: formatAmount(projection.pct_bw_per_week) })}
            </AppText>
            {projection.warnings.map((warning) => (
              <AppText key={warning.code} variant="caption" color={warning.code === 'SURPLUS_MOSTLY_FAT' ? theme.colors.warningText : theme.colors.textSecondary}>
                {tm(warning.message)}
              </AppText>
            ))}
            {projection.warnings.some((warning) => warning.code === 'SURPLUS_MOSTLY_FAT') ? (
              <AppText variant="bodyMedium" color={theme.colors.warningText}>{t('calc.mostlyFat')}</AppText>
            ) : null}
          </Card>
          <Card style={{ gap: theme.spacing.sm }}>
            {projection.horizons.map((row) => (
              <View key={row.horizon_days} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{tm(horizonMsg(row.horizon_days))}</AppText>
                  <AppText variant="caption" color={theme.colors.textSecondary}>
                    {t(row.model === 'static' ? 'calc.model.static' : 'calc.model.weekly')}
                  </AppText>
                  {row.clamped ? (
                    <AppText variant="caption" color={theme.colors.warningText} testID={`clamped-${row.horizon_days}`}>
                      † {t('calc.clampedNote')}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="macroGrams">
                  {`${withUnit(formatSigned(row.delta_kg_r), 'kg')}${NBSP}/${NBSP}${withUnit(formatSigned(row.delta_lb_r), 'lb')}${row.clamped ? `${NBSP}†` : ''}`}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {t('calc.horizonNote')}
            </AppText>
          </Card>
            </>
          )}
        </View>
      ) : null}

      {mode !== 'calories' ? <PrimaryButton label={t('calc.saveProgress')} onPress={saveStat} disabled={typedInvalid} /> : null}
      {savedNote ? <AppText variant="caption" color={theme.colors.successText}>{tm(savedNote)}</AppText> : null}
      <Disclaimer />
    </Screen>
  );
}
