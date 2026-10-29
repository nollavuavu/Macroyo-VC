import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import {
  ACTIVITY_DETAILS,
  GOAL_DETAILS,
  assessTargets,
  bmiMetric,
  buildMacroPlan,
  feetInchesToCm,
  lbToKg,
  parseDecimal,
  validateAge,
  validateBodyFat,
  validateHeightCm,
  validateWeightKg,
  type ActivityLevel,
  type BmrFormula,
  type Goal,
  type Sex,
  type SexConstantChoice,
} from '@/src/lib/domain';
import { FormulaPicker, SexConstantPicker } from '@/src/components/BmrChoices';
import { formatKcal } from '@/src/lib/format';
import type { Profile } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, Chip, Disclaimer, Field, PrimaryButton, Screen, SecondaryButton, Segmented } from '@/src/components/ui';

const STEPS = ['Welcome', 'Body', 'Activity', 'Goal', 'Plan'] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const { ready, data, saveProfile } = useApp();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [ageText, setAgeText] = useState('');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [heightText, setHeightText] = useState('');
  const [feetText, setFeetText] = useState('');
  const [inchText, setInchText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [fatText, setFatText] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [pregnant, setPregnant] = useState(false);
  const [formulaChoice, setFormulaChoice] = useState<BmrFormula | null>(null);
  const [sexConstant, setSexConstant] = useState<SexConstantChoice | null>(null);
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [carbText, setCarbText] = useState('');
  const [fatTargetText, setFatTargetText] = useState('');
  const [targetsEdited, setTargetsEdited] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const age = parseDecimal(ageText);
  const weightKg = units === 'metric' ? parseDecimal(weightText) : weightFromLb(weightText);
  const heightCm = units === 'metric' ? parseDecimal(heightText) : heightFromImperial(feetText, inchText);
  const bodyFat = fatText.trim() === '' ? null : parseDecimal(fatText);
  const ageCheck = validateAge(age);
  const heightCheck = validateHeightCm(heightCm);
  const weightCheck = validateWeightKg(weightKg);
  const fatCheck = validateBodyFat(bodyFat);

  const plan = useMemo(() => {
    if (!sex || !ageCheck.ok || !heightCheck.ok || !weightCheck.ok || !fatCheck.ok || !activity || heightCm == null || weightKg == null || age == null) {
      return null;
    }
    return buildMacroPlan({
      sex,
      age,
      heightCm,
      weightKg,
      bodyFatPct: bodyFat,
      activity,
      goal: goal ?? 'maintain',
      formula: formulaChoice ?? undefined,
      pregnant,
      sexConstant,
    });
  }, [activity, age, ageCheck.ok, bodyFat, fatCheck.ok, formulaChoice, goal, heightCheck.ok, heightCm, pregnant, sex, sexConstant, weightCheck.ok, weightKg]);

  if (!ready) return null;
  if (data.profile?.onboardingComplete) return <Redirect href="/(tabs)" />;

  const bmi = heightCm != null && weightKg != null ? bmiMetric(weightKg, heightCm) : null;

  function next() {
    setShowErrors(true);
    if (step === 1) {
      if (!sex || !ageCheck.ok || !heightCheck.ok || !weightCheck.ok || !fatCheck.ok) return;
    }
    if (step === 2 && !activity) return;
    if (step === 3 && !goal) return;
    if (step === 3 && goal === 'cut' && plan && !plan.goalAllowed) return;
    setShowErrors(false);
    if (step === 3 && plan) {
      setKcalText(String(plan.kcal));
      setProteinText(String(plan.proteinG));
      setCarbText(String(plan.carbsG));
      setFatTargetText(String(plan.fatG));
      setTargetsEdited(false);
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  async function finish() {
    if (!plan || !sex || age == null || heightCm == null || weightKg == null || !activity || !goal) return;
    const draft = {
      kcal: parseDecimal(kcalText),
      proteinG: parseDecimal(proteinText),
      carbsG: parseDecimal(carbText),
      fatG: parseDecimal(fatTargetText),
    };
    // Generated targets go through the same check as typed ones, so an invalid plan can never be saved silently.
    const review = assessTargets(
      targetsEdited ? draft : { kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG },
      sex,
      plan.bmr,
      weightKg,
      plan.tdee,
      plan.goal,
    );
    if (review.blocking) {
      setShowErrors(true);
      return;
    }
    const targets = targetsEdited && draft.kcal != null && draft.proteinG != null && draft.carbsG != null && draft.fatG != null
      ? { kcal: draft.kcal, proteinG: draft.proteinG, carbsG: draft.carbsG, fatG: draft.fatG, fiberG: plan.fiberG, custom: true }
      : { kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG, fiberG: plan.fiberG, custom: false };
    const profile: Profile = {
      sex,
      age,
      heightCm,
      weightKg,
      bodyFatPct: bodyFat,
      activity,
      goal: plan.goal,
      units,
      appearance: 'system',
      pregnant,
      formula: plan.formula,
      formulaOverride: formulaChoice,
      sexConstant: sex === 'unspecified' ? sexConstant : null,
      targets,
      onboardingComplete: true,
    };
    await saveProfile(profile);
    router.replace('/(tabs)');
  }

  return (
    <Screen testID="screen-onboarding">
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {step + 1} of {STEPS.length} · {STEPS[step]}
        </AppText>
        <View style={{ height: 4, borderRadius: 99, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: 4, backgroundColor: theme.colors.primary }} />
        </View>
      </View>

      {step === 0 ? (
        <View style={{ gap: theme.spacing.lg }}>
          <AppText variant="title">Macroyo</AppText>
          <AppText>Log meals fast. Hit your macros. Know your numbers.</AppText>
          <Disclaimer />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: theme.spacing.lg }}>
          <AppText variant="title">About you</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>Sex is used only for the energy equation.</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {(['female', 'male', 'unspecified'] as Sex[]).map((option) => (
              <Chip key={option} label={option === 'unspecified' ? 'Unspecified' : option === 'female' ? 'Female' : 'Male'} selected={sex === option} onPress={() => setSex(option)} />
            ))}
          </View>
          {showErrors && !sex ? <AppText variant="caption" color={theme.colors.warningText}>Choose a sex option. Unspecified uses an average equation.</AppText> : null}
          <SexConstantPicker sex={sex} value={sexConstant} onChange={setSexConstant} />
          <Field label="Age" value={ageText} onChangeText={setAgeText} keyboard="number" error={showErrors ? ageCheck.message : null} suffix="years" />
          {ageCheck.underage ? (
            <Card>
              <AppText variant="section">Macroyo is for adults</AppText>
              <AppText variant="secondary" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>
                Calorie targets and body-composition indexes are not built for people under 18. If you are under 18, please talk with a parent or guardian and a clinician. You can correct the age above if it was a typo.
              </AppText>
            </Card>
          ) : null}
          <Segmented
            value={units}
            onChange={setUnits}
            options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]}
          />
          {units === 'metric' ? (
            <Field label="Height" value={heightText} onChangeText={setHeightText} suffix="cm" error={showErrors ? heightCheck.message : null} />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label="Feet" value={feetText} onChangeText={setFeetText} keyboard="number" error={showErrors ? heightCheck.message : null} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Inches" value={inchText} onChangeText={setInchText} error={showErrors && !heightCheck.ok ? ' ' : null} />
              </View>
            </View>
          )}
          <Field label="Weight" value={weightText} onChangeText={setWeightText} suffix={units === 'metric' ? 'kg' : 'lb'} error={showErrors ? weightCheck.message : null} />
          <Field label="Body fat % (optional)" value={fatText} onChangeText={setFatText} suffix="%" placeholder="Skip if you don't know" error={showErrors ? fatCheck.message : null} />
          <Chip label={pregnant ? 'Pregnant or breastfeeding' : 'Not pregnant or breastfeeding'} selected={pregnant} onPress={() => setPregnant((value) => !value)} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Activity</AppText>
          {(Object.keys(ACTIVITY_DETAILS) as ActivityLevel[]).map((level) => (
            <Chip
              key={level}
              label={ACTIVITY_DETAILS[level].label}
              detail={ACTIVITY_DETAILS[level].description}
              selected={activity === level}
              onPress={() => setActivity(level)}
            />
          ))}
          {showErrors && !activity ? <AppText variant="caption" color={theme.colors.warningText}>Choose an activity level.</AppText> : null}
        </View>
      ) : null}

      {step === 3 && plan ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Goal</AppText>
          {bmi != null ? <AppText variant="secondary" color={theme.colors.textSecondary}>BMI {bmi.toFixed(1)} from the numbers you entered.</AppText> : null}
          {(Object.keys(GOAL_DETAILS) as Goal[]).map((option) => {
            const blocked = option === 'cut' && (!plan.goalAllowed || pregnant || (bmi != null && bmi < 18.5) || plan.deficitUnavailable);
            const reason = option === 'cut' ? buildMacroPlan({ ...planInput(), goal: 'cut' }).goalBlockReason : null;
            return (
              <View key={option} style={{ gap: 4 }}>
                <Chip
                  label={GOAL_DETAILS[option].label}
                  detail={GOAL_DETAILS[option].description}
                  selected={goal === option}
                  disabled={blocked}
                  onPress={() => setGoal(option)}
                />
                {blocked && reason ? <AppText variant="caption" color={theme.colors.warningText}>{reason}</AppText> : null}
              </View>
            );
          })}
          {showErrors && !goal ? <AppText variant="caption" color={theme.colors.warningText}>Choose a goal.</AppText> : null}
        </View>
      ) : null}

      {step === 4 && plan ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">Your plan</AppText>
          <Card>
            <FormulaPicker plan={plan} bodyFatEntered={bodyFat != null} onChange={(value) => { setFormulaChoice(value); setTargetsEdited(false); }} />
            <AppText variant="metricNumber" style={{ marginTop: 8 }}>{formatKcal(plan.tdee)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>Maintenance kcal, from BMR {formatKcal(plan.bmr)}</AppText>
            {plan.capped && plan.capReason ? <AppText variant="caption" color={theme.colors.warningText} style={{ marginTop: 8 }}>{plan.capReason}</AppText> : null}
          </Card>
          <Field label="Calories" value={targetsEdited ? kcalText : String(plan.kcal)} onChangeText={(value) => { setTargetsEdited(true); setKcalText(value); }} suffix="kcal" error={targetError('kcal')} />
          <Field label="Protein" value={targetsEdited ? proteinText : String(plan.proteinG)} onChangeText={(value) => { setTargetsEdited(true); setProteinText(value); }} suffix="g" error={targetError('proteinG')} />
          <Field label="Carbs" value={targetsEdited ? carbText : String(plan.carbsG)} onChangeText={(value) => { setTargetsEdited(true); setCarbText(value); }} suffix="g" error={targetError('carbsG')} />
          <Field label="Fat" value={targetsEdited ? fatTargetText : String(plan.fatG)} onChangeText={(value) => { setTargetsEdited(true); setFatTargetText(value); }} suffix="g" error={targetError('fatG')} />
          <AppText variant="caption" color={theme.colors.textSecondary}>
            Suggested split is about {plan.proteinG} g protein ({plan.proteinPerKg} g/kg), {plan.fatG} g fat, {plan.carbsG} g carbs. Fiber is a soft goal of {plan.fiberG} g. Macros at those grams are {plan.macroKcal} kcal.
          </AppText>
          {plan.proteinCapped && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Protein was limited to 35% of calories ({plan.proteinG} g instead of {plan.proteinUncappedG} g from {plan.proteinPerKg} g/kg), because that body weight over-counts protein on a lower target.
            </AppText>
          ) : null}
          {plan.fatTrimmed && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.textSecondary}>Fat was lowered toward its minimum so carbs would not go below zero.</AppText>
          ) : null}
          {plan.macroOvershoot && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.warningText}>Protein and fat already add up to {plan.macroKcal} kcal, a little above the {plan.kcal} kcal target.</AppText>
          ) : null}
          {plan.veryLowCarb && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.warningText}>Carbs are under 50 g. That is very low for most people. Consider raising calories or lowering fat or protein. This is a warning, not a block.</AppText>
          ) : null}
          <Disclaimer />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {step > 0 ? <View style={{ flex: 1 }}><SecondaryButton label="Back" onPress={() => { setShowErrors(false); setStep((value) => value - 1); }} testID="onboarding-back" /></View> : null}
        <View style={{ flex: 1 }}>
          {step < STEPS.length - 1 ? (
            <PrimaryButton label="Next" onPress={next} disabled={step === 1 && ageCheck.underage} testID="onboarding-next" />
          ) : (
            <PrimaryButton label="Start tracking" onPress={finish} testID="onboarding-finish" />
          )}
        </View>
      </View>
    </Screen>
  );

  function planInput() {
    return {
      sex: sex ?? 'female',
      age: age ?? 30,
      heightCm: heightCm ?? 165,
      weightKg: weightKg ?? 60,
      bodyFatPct: bodyFat,
      activity: activity ?? 'sedentary',
      goal: 'cut' as const,
      formula: formulaChoice ?? undefined,
      pregnant,
      sexConstant,
    };
  }

  function targetError(field: 'kcal' | 'proteinG' | 'carbsG' | 'fatG'): string | null {
    if (!showErrors || !targetsEdited || !plan || !sex || weightKg == null) return null;
    const review = assessTargets({
      kcal: parseDecimal(kcalText),
      proteinG: parseDecimal(proteinText),
      carbsG: parseDecimal(carbText),
      fatG: parseDecimal(fatTargetText),
    }, sex, plan.bmr, weightKg, plan.tdee, plan.goal);
    return review.issues.find((issue) => issue.field === field)?.message ?? null;
  }
}

function weightFromLb(text: string): number | null {
  const pounds = parseDecimal(text);
  return pounds == null ? null : lbToKg(pounds);
}

function heightFromImperial(feetText: string, inchText: string): number | null {
  const feet = parseDecimal(feetText);
  const inches = inchText.trim() === '' ? 0 : parseDecimal(inchText);
  if (feet == null || inches == null) return null;
  return feetInchesToCm(feet, inches);
}
