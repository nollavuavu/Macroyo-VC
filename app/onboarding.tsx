import { useMemo, useState } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
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
  targetNotices,
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
import { formatFixed, formatInputNumber, formatKcal } from '@/src/lib/format';
import { useI18n } from '@/src/i18n/react';
import { LANGUAGE_PREFS, type Msg } from '@/src/i18n/types';
import type { Profile } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, Chip, Disclaimer, Field, PrimaryButton, Screen, SecondaryButton, Segmented, SwitchRow } from '@/src/components/ui';

const STEPS = ['welcome', 'body', 'activity', 'goal', 'plan'] as const;

export default function OnboardingScreen() {
  const theme = useTheme();
  const { t, tm } = useI18n();
  const text = (message?: Msg | null) => (message ? tm(message) : null);
  const { height: windowHeight } = useWindowDimensions();
  const { ready, data, saveProfile, setLanguage } = useApp();
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
  // What the Plan step shows right now: the suggestion until the user edits, then their numbers.
  const shownDraft = targetsEdited || !plan
    ? { kcal: parseDecimal(kcalText), proteinG: parseDecimal(proteinText), carbsG: parseDecimal(carbText), fatG: parseDecimal(fatTargetText) }
    : { kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG };

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
      setKcalText(formatInputNumber(plan.kcal));
      setProteinText(formatInputNumber(plan.proteinG));
      setCarbText(formatInputNumber(plan.carbsG));
      setFatTargetText(formatInputNumber(plan.fatG));
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
    if (!(await saveProfile(profile))) return; // the banner explains why nothing was saved
    router.replace('/(tabs)');
  }

  return (
    <Screen testID="screen-onboarding">
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {t('onboarding.stepOf', { current: step + 1, total: STEPS.length, name: t(`onboarding.step.${STEPS[step]}`) })}
        </AppText>
        <View style={{ height: 4, borderRadius: 99, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${((step + 1) / STEPS.length) * 100}%`, height: 4, backgroundColor: theme.colors.primary }} />
        </View>
      </View>

      {step === 0 ? (
        <View style={{ gap: theme.spacing.lg, minHeight: windowHeight * 0.55, justifyContent: 'center', alignItems: 'center' }}>
          <Image
            source={require('../assets/icon.png')}
            accessibilityIgnoresInvertColors
            accessibilityLabel={t('onboarding.logoLabel')}
            style={{ width: 96, height: 96, borderRadius: 22 }}
          />
          <AppText variant="title" style={{ textAlign: 'center' }}>Macroyo</AppText>
          <AppText style={{ textAlign: 'center' }}>{t('onboarding.tagline')}</AppText>
          <Disclaimer />
          <View style={{ alignSelf: 'stretch', gap: theme.spacing.sm }}>
            <AppText variant="caption" color={theme.colors.textSecondary} style={{ textAlign: 'center' }}>{t('profile.language')}</AppText>
            <Segmented
              value={data.language ?? 'system'}
              onChange={(language) => { void setLanguage(language); }}
              options={LANGUAGE_PREFS.map((value) => ({ value, label: t(`lang.${value}`) }))}
            />
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: theme.spacing.lg }}>
          <AppText variant="title">{t('onboarding.aboutYou')}</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>{t('onboarding.sexNote')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {(['female', 'male', 'unspecified'] as Sex[]).map((option) => (
              <Chip key={option} label={t(`sex.${option}`)} selected={sex === option} onPress={() => setSex(option)} />
            ))}
          </View>
          {showErrors && !sex ? <AppText variant="caption" color={theme.colors.warningText}>{t('onboarding.chooseSex')}</AppText> : null}
          <SexConstantPicker sex={sex} value={sexConstant} onChange={setSexConstant} />
          <Field label={t('common.age')} value={ageText} onChangeText={setAgeText} keyboard="number" error={showErrors ? text(ageCheck.message) : null} suffix={t('unit.years')} />
          {ageCheck.underage ? (
            <Card>
              <AppText variant="section">{t('onboarding.adultsTitle')}</AppText>
              <AppText variant="secondary" color={theme.colors.textSecondary} style={{ marginTop: 8 }}>
                {t('onboarding.adultsBody')}
              </AppText>
            </Card>
          ) : null}
          <Segmented
            value={units}
            onChange={setUnits}
            options={[{ value: 'metric', label: t('units.metric') }, { value: 'imperial', label: t('units.imperial') }]}
          />
          {units === 'metric' ? (
            <Field label={t('common.height')} value={heightText} onChangeText={setHeightText} suffix="cm" error={showErrors ? text(heightCheck.message) : null} />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label={t('common.feet')} value={feetText} onChangeText={setFeetText} keyboard="number" error={showErrors ? text(heightCheck.message) : null} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('common.inches')} value={inchText} onChangeText={setInchText} error={showErrors && !heightCheck.ok ? ' ' : null} />
              </View>
            </View>
          )}
          <Field label={t('common.weight')} value={weightText} onChangeText={setWeightText} suffix={units === 'metric' ? 'kg' : 'lb'} error={showErrors ? text(weightCheck.message) : null} />
          <Field label={t('common.bodyFatOptional')} value={fatText} onChangeText={setFatText} suffix="%" placeholder={t('onboarding.bodyFatPlaceholder')} error={showErrors ? text(fatCheck.message) : null} />
          <SwitchRow label={t('common.pregnant')} value={pregnant} onValueChange={setPregnant} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('onboarding.activityTitle')}</AppText>
          {(Object.keys(ACTIVITY_DETAILS) as ActivityLevel[]).map((level) => (
            <Chip
              key={level}
              label={tm(ACTIVITY_DETAILS[level].label)}
              detail={tm(ACTIVITY_DETAILS[level].description)}
              selected={activity === level}
              onPress={() => setActivity(level)}
            />
          ))}
          {showErrors && !activity ? <AppText variant="caption" color={theme.colors.warningText}>{t('onboarding.chooseActivity')}</AppText> : null}
        </View>
      ) : null}

      {step === 3 && plan ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('common.goal')}</AppText>
          {bmi != null ? <AppText variant="secondary" color={theme.colors.textSecondary}>{t('onboarding.bmiLine', { bmi: formatFixed(bmi, 1) })}</AppText> : null}
          {(Object.keys(GOAL_DETAILS) as Goal[]).map((option) => {
            const blocked = option === 'cut' && (!plan.goalAllowed || pregnant || (bmi != null && bmi < 18.5) || plan.deficitUnavailable);
            const reason = option === 'cut' ? buildMacroPlan({ ...planInput(), goal: 'cut' }).goalBlockReason : null;
            return (
              <View key={option} style={{ gap: 4 }}>
                <Chip
                  label={tm(GOAL_DETAILS[option].label)}
                  detail={tm(GOAL_DETAILS[option].description)}
                  selected={goal === option}
                  disabled={blocked}
                  onPress={() => setGoal(option)}
                />
                {blocked && reason ? <AppText variant="caption" color={theme.colors.warningText}>{tm(reason)}</AppText> : null}
              </View>
            );
          })}
          {showErrors && !goal ? <AppText variant="caption" color={theme.colors.warningText}>{t('onboarding.chooseGoal')}</AppText> : null}
        </View>
      ) : null}

      {step === 4 && plan ? (
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="title">{t('onboarding.planTitle')}</AppText>
          <Card>
            <FormulaPicker plan={plan} bodyFatEntered={bodyFat != null} onChange={(value) => { setFormulaChoice(value); setTargetsEdited(false); }} />
            <AppText variant="metricNumber" style={{ marginTop: 8 }}>{formatKcal(plan.tdee)}</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>{t('onboarding.maintenance', { bmr: formatKcal(plan.bmr) })}</AppText>
            {plan.capped && plan.capReason ? <AppText variant="caption" color={theme.colors.warningText} style={{ marginTop: 8 }}>{tm(plan.capReason)}</AppText> : null}
          </Card>
          <Field label={t('common.calories')} value={targetsEdited ? kcalText : formatInputNumber(plan.kcal)} onChangeText={(value) => { setTargetsEdited(true); setKcalText(value); }} suffix="kcal" error={targetError('kcal')} />
          <Field label={t('macro.protein')} value={targetsEdited ? proteinText : formatInputNumber(plan.proteinG)} onChangeText={(value) => { setTargetsEdited(true); setProteinText(value); }} suffix="g" error={targetError('proteinG')} />
          <Field label={t('macro.carbs')} value={targetsEdited ? carbText : formatInputNumber(plan.carbsG)} onChangeText={(value) => { setTargetsEdited(true); setCarbText(value); }} suffix="g" error={targetError('carbsG')} />
          <Field label={t('macro.fat')} value={targetsEdited ? fatTargetText : formatInputNumber(plan.fatG)} onChangeText={(value) => { setTargetsEdited(true); setFatTargetText(value); }} suffix="g" error={targetError('fatG')} />
          <AppText variant="caption" color={theme.colors.textSecondary}>
            {t('onboarding.splitNote', { protein: plan.proteinG, perKg: plan.proteinPerKg, fat: plan.fatG, carbs: plan.carbsG, fiber: plan.fiberG, kcal: plan.macroKcal })}
          </AppText>
          {plan.proteinCapped && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {t('onboarding.proteinLimited', { protein: plan.proteinG, uncapped: plan.proteinUncappedG, perKg: plan.proteinPerKg })}
            </AppText>
          ) : null}
          {plan.fatTrimmed && !targetsEdited ? (
            <AppText variant="caption" color={theme.colors.textSecondary}>{t('onboarding.fatTrimmed')}</AppText>
          ) : null}
          {targetNotices(shownDraft).map((notice) => (
            <AppText key={notice.message.key} variant="caption" color={theme.colors.warningText} accessibilityRole="alert" testID={`notice-${notice.field}`}>
              {tm(notice.message)}
            </AppText>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {step > 0 ? <View style={{ flex: 1 }}><SecondaryButton label={t('common.back')} onPress={() => { setShowErrors(false); setStep((value) => value - 1); }} testID="onboarding-back" /></View> : null}
        <View style={{ flex: 1 }}>
          {step < STEPS.length - 1 ? (
            <PrimaryButton label={step === 0 ? t('onboarding.getStarted') : t('common.next')} onPress={next} disabled={step === 1 && ageCheck.underage} testID="onboarding-next" />
          ) : (
            <PrimaryButton label={t('onboarding.startTracking')} onPress={finish} testID="onboarding-finish" />
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
    return text(review.issues.find((issue) => issue.field === field && issue.blocking)?.message);
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
