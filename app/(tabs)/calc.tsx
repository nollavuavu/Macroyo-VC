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
  roundHalfUp1,
  validateBodyFat,
  validateHeightCm,
  validateWeightKg,
  validateTypedMeasure,
  DEFICIT_UNAVAILABLE_MESSAGE,
  type ActivityLevel,
  type Sex,
} from '@/src/lib/domain';
import { ACTIVITY_DETAILS, ACTIVITY_FACTORS, bmiTone } from '@/src/lib/domain';
import { localDateISO, uid } from '@/src/lib/dates';
import { formatAmount, formatKcal, formatSigned } from '@/src/lib/format';
import { useApp, useTheme } from '@/src/state/AppContext';
import { FormulaPicker, SexConstantPicker } from '@/src/components/BmrChoices';
import { AppText, Card, Chip, Disclaimer, Field, GroupLabel, PrimaryButton, Screen, Segmented } from '@/src/components/ui';

type Mode = 'bmi' | 'ffmi' | 'calories';
type Direction = 'deficit' | 'surplus';

const PRESETS = [100, 250, 500, 750, 1000];

export default function CalcScreen() {
  const theme = useTheme();
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
  const [savedNote, setSavedNote] = useState<string | null>(null);
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
    setSavedNote(ok ? 'Saved to progress. Your profile was left unchanged.' : null);
  }

  return (
    <Screen testID="screen-calc">
      <AppText variant="title">Calc</AppText>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'bmi', label: 'BMI' },
          { value: 'ffmi', label: 'FFMI' },
          { value: 'calories', label: 'Calories' },
        ]}
      />
      <Segmented
        value={units}
        onChange={(value) => { setUnits(value); setHeightText(null); setWeightText(null); }}
        options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="secondary" color={theme.colors.textSecondary}>Height</AppText>
        <AppText variant="inputNumber">{units === 'metric' ? `${formatAmount(heightCm)} cm` : `${formatAmount(heightCm / 2.54)} in`}</AppText>
        <Slider minimumValue={120} maximumValue={230} value={heightCm} onValueChange={(value) => { setHeightCm(value); setHeightText(null); }} minimumTrackTintColor={theme.colors.primary} maximumTrackTintColor={theme.colors.border} thumbTintColor={theme.colors.primary} />
        <Field label="Type a height" value={heightText ?? ''} onChangeText={(value) => {
          setHeightText(value);
          const typed = validateTypedMeasure('height', value, units);
          if (typed.ok && typed.value != null) setHeightCm(typed.value);
        }} suffix={units === 'metric' ? 'cm' : 'in'} error={heightError} />
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="secondary" color={theme.colors.textSecondary}>Weight</AppText>
        <AppText variant="inputNumber">{units === 'metric' ? `${formatAmount(weightKg)} kg` : `${formatAmount(weightKg / 0.45359237)} lb`}</AppText>
        <Slider minimumValue={30} maximumValue={250} value={Math.min(250, Math.max(30, weightKg))} onValueChange={(value) => { setWeightKg(value); setWeightText(null); }} minimumTrackTintColor={theme.colors.primary} maximumTrackTintColor={theme.colors.border} thumbTintColor={theme.colors.primary} />
        <Field label="Type a weight" value={weightText ?? ''} onChangeText={(value) => {
          setWeightText(value);
          const typed = validateTypedMeasure('weight', value, units);
          if (typed.ok && typed.value != null) setWeightKg(typed.value);
        }} suffix={units === 'metric' ? 'kg' : 'lb'} error={weightError} />
      </Card>

      {mode === 'ffmi' || mode === 'calories' ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="secondary" color={theme.colors.textSecondary}>Body fat</AppText>
          <AppText variant="inputNumber">{bodyFat == null ? '—' : `${formatAmount(bodyFat)} %`}</AppText>
          <Slider
            minimumValue={3}
            maximumValue={60}
            value={bodyFat ?? 20}
            onValueChange={(value) => setBodyFat(Math.round(value * 10) / 10)}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.primary}
          />
          {fatError ? <AppText variant="caption" color={theme.colors.warningText}>{fatError}</AppText> : null}
          <Chip label="Not sure" selected={bodyFat == null} onPress={() => setBodyFat(null)} />
        </Card>
      ) : null}

      {typedInvalid ? (
        <Card>
          <AppText variant="secondary" color={theme.colors.warningText} accessibilityRole="alert">Fix the highlighted entry to see results. Nothing below is calculated from an invalid number.</AppText>
        </Card>
      ) : null}

      {!typedInvalid && mode === 'bmi' && bmi != null && bmiClass ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="metricNumber">{roundHalfUp1(bmi).toFixed(1)}</AppText>
          <AppText variant="section" color={bmiTone(bmi) === 'success' ? theme.colors.successText : theme.colors.warningText}>{bmiClass.label}</AppText>
          {bmiClass.detail ? <AppText variant="secondary" color={theme.colors.textSecondary}>{bmiClass.detail}</AppText> : null}
          <AppText variant="caption" color={theme.colors.textSecondary}>BMI does not tell muscle from fat. That is what FFMI is for.</AppText>
        </Card>
      ) : null}

      {!typedInvalid && mode === 'ffmi' ? (
        <Card style={{ gap: theme.spacing.sm }}>
          {bodyFat == null || ffmi == null || nffmi == null || !ffmiReading ? (
            <AppText>Enter body fat to see FFMI. Without it the number would not mean anything.</AppText>
          ) : (
            <>
              <AppText variant="caption" color={theme.colors.textSecondary}>FFMI</AppText>
              <AppText variant="metricNumber">{roundHalfUp1(ffmi).toFixed(1)}</AppText>
              <AppText variant="secondary" color={theme.colors.textSecondary}>Normalized {roundHalfUp1(nffmi).toFixed(1)}</AppText>
              <AppText variant="section" color={theme.colors.primary}>{ffmiReading.label}</AppText>
              <AppText variant="caption" color={theme.colors.textSecondary}>{ffmiReading.detail}</AppText>
              {sex !== 'male' ? (
                <AppText variant="caption" color={theme.colors.textSecondary}>Bands shown are from male reference data.</AppText>
              ) : null}
              <AppText variant="caption" color={theme.colors.textSecondary}>
                Lean mass {formatAmount(lean ?? 0)} kg. FFMI = lean ÷ height². Normalized FFMI = FFMI + 6.1 × (1.8 − height in m).
              </AppText>
            </>
          )}
        </Card>
      ) : null}

      {mode === 'calories' && projection ? (
        <View style={{ gap: theme.spacing.md }}>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="secondary" color={theme.colors.textSecondary}>Maintenance</AppText>
            <AppText variant="metricNumber">{typedInvalid ? '—' : formatKcal(projection.tdee_kcal)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Estimate · BMR {typedInvalid ? '—' : formatKcal(plan.bmr)} kcal
            </AppText>
            <FormulaPicker plan={plan} bodyFatEntered={bodyFat != null} onChange={setFormulaOverride} />
            <GroupLabel>Sex</GroupLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(['female', 'male', 'unspecified'] as Sex[]).map((option) => (
                <Chip key={option} label={option === 'unspecified' ? 'Unspecified' : option === 'female' ? 'Female' : 'Male'} selected={sex === option} onPress={() => setSex(option)} />
              ))}
            </View>
            <SexConstantPicker sex={sex} value={sexConstant} onChange={setSexConstant} />
            <Field label="Age" value={ageText ?? String(age)} onChangeText={(value) => {
              setAgeText(value);
              const typed = validateTypedMeasure('age', value, units);
              if (typed.ok && typed.value != null) setAge(typed.value);
            }} error={typedAge?.message} suffix="years" keyboard="number" />
            <GroupLabel>Activity level</GroupLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(Object.keys(ACTIVITY_FACTORS) as ActivityLevel[]).map((level) => (
                <Chip
                  key={level}
                  label={ACTIVITY_DETAILS[level].label}
                  detail={ACTIVITY_DETAILS[level].description}
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
              { value: 'deficit', label: 'Deficit', disabled: projection.deficit_unavailable },
              { value: 'surplus', label: 'Surplus' },
            ]}
          />
          {projection.deficit_unavailable ? (
            <AppText variant="secondary" color={theme.colors.warningText}>
              {DEFICIT_UNAVAILABLE_MESSAGE}
            </AppText>
          ) : (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Maximum deficit {formatAmount(cap)} kcal/day, set by {binding}.
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
            label="Custom kcal per day"
            value={customText}
            onChangeText={setCustomText}
            placeholder="e.g. 300 or -300"
          />
          {customText.trim() && !parsedCustom.valid ? (
            <AppText variant="caption" color={theme.colors.warningText}>
              {parsedCustom.message} Nothing is applied until the number is valid.
            </AppText>
          ) : null}
          {direction === 'deficit' && !projection.deficit_unavailable && customText && parsedCustom.valid && parsedCustom.magnitude > cap ? (
            <AppText variant="caption" color={theme.colors.warningText}>
              That deficit is above the maximum of {formatAmount(cap)} kcal, so the projection uses the cap.
            </AppText>
          ) : null}
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="secondary" color={theme.colors.textSecondary}>Target intake</AppText>
            <AppText variant="metricNumber">{formatKcal(projection.target_kcal)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Effective offset {formatSigned(projection.effective_offset_kcal, 0)} kcal/day · {formatAmount(projection.pct_bw_per_week)}% of body weight per week. Every number is an estimate.
            </AppText>
            {projection.warnings.map((warning) => (
              <AppText key={warning.code + warning.message} variant="caption" color={warning.code === 'SURPLUS_MOSTLY_FAT' ? theme.colors.warningText : theme.colors.textSecondary}>
                {warning.message}
              </AppText>
            ))}
            {projection.warnings.some((warning) => warning.code === 'SURPLUS_MOSTLY_FAT') ? (
              <AppText variant="bodyMedium" color={theme.colors.warningText}>Most of this surplus will be fat.</AppText>
            ) : null}
          </Card>
          <Card style={{ gap: theme.spacing.sm }}>
            {projection.horizons.map((row) => (
              <View key={row.horizon_days} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium">{row.label}</AppText>
                  <AppText variant="caption" color={theme.colors.textSecondary}>
                    {row.model === 'static' ? 'Fixed 7,700 kcal/kg' : 'Simplified weekly model'} · estimate
                  </AppText>
                  {row.clamped ? (
                    <AppText variant="caption" color={theme.colors.warningText} testID={`clamped-${row.horizon_days}`}>
                      † Stopped at a healthy minimum BMI
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="macroGrams">
                  {formatSigned(row.delta_kg_r)} kg / {formatSigned(row.delta_lb_r)} lb{row.clamped ? ' †' : ''}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Real weight change slows over time as a lighter body burns less energy. The first week and month hold the gap steady. From 3 months on, maintenance is recomputed each week. Scale weight also moves with water and glycogen.
            </AppText>
          </Card>
            </>
          )}
        </View>
      ) : null}

      {mode !== 'calories' ? <PrimaryButton label="Save to progress" onPress={saveStat} disabled={typedInvalid} /> : null}
      {savedNote ? <AppText variant="caption" color={theme.colors.successText}>{savedNote}</AppText> : null}
      <Disclaimer />
    </Screen>
  );
}
