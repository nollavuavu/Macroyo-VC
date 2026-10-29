import { useCallback, useEffect, useRef, useState } from 'react';
import { nextBanner } from '@/src/lib/banner';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  ACTIVITY_DETAILS,
  GOAL_DETAILS,
  assessTargets,
  buildMacroPlan,
  feetInchesToCm,
  lbToKg,
  parseDecimal,
  validateAge,
  validateBodyFat,
  validateHeightCm,
  validateWeightKg,
  normalizeFeetInches,
  targetNotices,
  valueUnlessUnchanged,
  type ActivityLevel,
  type BmrFormula,
  type Goal,
  type Sex,
  type SexConstantChoice,
} from '@/src/lib/domain';
import { FormulaPicker, SexConstantPicker } from '@/src/components/BmrChoices';
import { formatAmount } from '@/src/lib/format';
import type { Appearance, Profile, UnitSystem } from '@/src/lib/storage/types';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, Chip, Disclaimer, Field, GroupLabel, PrimaryButton, Screen, SecondaryButton, Segmented, SwitchRow } from '@/src/components/ui';

export default function ProfileScreen() {
  const theme = useTheme();
  const { data, updateProfile, resetAll } = useApp();
  const profile = data.profile;
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback((_?: string | null) => setNotice((current) => nextBanner(current, { type: 'edit' })), []);
  if (!profile) {
    return (
      <Screen testID="screen-profile">
        <AppText variant="title">Profile</AppText>
        <AppText>Finish onboarding to edit your targets.</AppText>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-profile">
      <AppText variant="title">Profile</AppText>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">Appearance</AppText>
        <Segmented
          value={profile.appearance}
          onChange={(appearance) => { void save({ ...profile, appearance }); }}
          options={[
            { value: 'system' as Appearance, label: 'System' },
            { value: 'light' as Appearance, label: 'Light' },
            { value: 'dark' as Appearance, label: 'Dark' },
          ]}
        />
        <AppText variant="section">Units</AppText>
        <Segmented
          value={profile.units}
          onChange={(units) => { void save({ ...profile, units }); }}
          options={[
            { value: 'metric' as UnitSystem, label: 'Metric' },
            { value: 'imperial' as UnitSystem, label: 'Imperial' },
          ]}
        />
        <AppText variant="caption" color={theme.colors.textSecondary}>
          Stored height {formatAmount(profile.heightCm)} cm · weight {formatAmount(profile.weightKg)} kg. Switching units only changes the display.
        </AppText>
      </Card>
      <BodyEditor
        key={`${profile.units}-${profile.heightCm}-${profile.weightKg}-${profile.age}-${profile.sex}-${profile.goal}`}
        profile={profile}
        onSave={save}
        onNotice={clearNotice}
      />
      <TargetEditor
        key={`${profile.targets.kcal}-${profile.targets.proteinG}-${profile.targets.carbsG}-${profile.targets.fatG}`}
        profile={profile}
        onSave={save}
        onNotice={clearNotice}
      />
      {notice ? <AppText variant="caption" color={theme.colors.successText}>{notice}</AppText> : null}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">Data</AppText>
        <AppText variant="secondary" color={theme.colors.textSecondary}>
          {data.logs.length} log entries · {data.bodyStats.length} body entries. Everything stays on this device.
        </AppText>
        {confirmReset ? (
          <>
            <AppText variant="caption" color={theme.colors.warningText}>This erases your profile, meals, and body stats.</AppText>
            <PrimaryButton label="Erase everything" onPress={async () => { await resetAll(); router.replace('/onboarding'); }} />
            <SecondaryButton label="Cancel" onPress={() => setConfirmReset(false)} />
          </>
        ) : (
          <SecondaryButton label="Reset data" onPress={() => setConfirmReset(true)} testID="reset-data" />
        )}
      </Card>
      <Disclaimer />
      <AppText variant="caption" color={theme.colors.textSecondary}>Macroyo · local only · no account</AppText>
    </Screen>
  );

  async function save(next: Profile, message = 'Saved.'): Promise<boolean> {
    setNotice((current) => nextBanner(current, { type: 'save-attempt' })); // a new attempt clears the previous banner
    const ok = await updateProfile(next);
    if (ok) setNotice((current) => nextBanner(current, { type: 'saved', message }));
    return ok;
  }
}

function BodyEditor({
  profile,
  onSave,
  onNotice,
}: {
  profile: Profile;
  onSave: (profile: Profile, message?: string) => Promise<boolean>;
  /** Called with null when the user edits a field, so a stale 'saved' banner goes away. */
  onNotice: (message: string | null) => void;
}) {
  const theme = useTheme();
  const [sex, setSex] = useState(profile.sex);
  const [ageText, setAgeText] = useState(String(profile.age));
  const initialTexts = useRef({ height: initialHeight(profile), inches: initialInches(profile), weight: initialWeight(profile) }).current;
  const [heightText, setHeightText] = useState(initialTexts.height);
  const [inchText, setInchText] = useState(initialTexts.inches);
  const [weightText, setWeightText] = useState(initialTexts.weight);
  const [fatText, setFatText] = useState(profile.bodyFatPct == null ? '' : String(profile.bodyFatPct));
  const [activity, setActivity] = useState(profile.activity);
  const [goal, setGoal] = useState(profile.goal);
  const [pregnant, setPregnant] = useState(profile.pregnant);
  const [formulaOverride, setFormulaOverride] = useState<BmrFormula | null>(profile.formulaOverride ?? null);
  const [sexConstant, setSexConstant] = useState<SexConstantChoice | null>(profile.sexConstant ?? null);
  const [error, setError] = useState<string | null>(null);

  // Imperial text is a rounded display of the stored metric value. If the user did not change the text,
  // keep the stored value so saving never drifts it (180 cm -> 180.086 cm).
  function resolveHeight(): number | null {
    const parsed = profile.units === 'metric' ? parseDecimal(heightText) : heightFromImperial(heightText, inchText);
    return valueUnlessUnchanged(`${heightText}|${inchText}`, `${initialTexts.height}|${initialTexts.inches}`, profile.heightCm, parsed);
  }
  function resolveWeight(): number | null {
    return valueUnlessUnchanged(weightText, initialTexts.weight, profile.weightKg, profile.units === 'metric' ? parseDecimal(weightText) : weightFromLb(weightText));
  }

  // Editing anything clears a stale 'saved' banner (skip the mount render).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) onNotice(null);
    mounted.current = true;
  }, [sex, ageText, heightText, inchText, weightText, fatText, activity, goal, pregnant, formulaOverride, sexConstant, onNotice]);

  // Live preview so the active formula, its BMR and the unspecified-sex note are always visible.
  const previewPlan = (() => {
    const age = parseDecimal(ageText);
    const heightCm = resolveHeight();
    const weightKg = resolveWeight();
    const bodyFat = fatText.trim() === '' ? null : parseDecimal(fatText);
    if (age == null || heightCm == null || weightKg == null || !validateAge(age).ok || !validateHeightCm(heightCm).ok || !validateWeightKg(weightKg).ok || !validateBodyFat(bodyFat).ok) return null;
    return { bodyFat, plan: buildMacroPlan({ sex, age, heightCm, weightKg, bodyFatPct: bodyFat, activity, goal, pregnant, formula: formulaOverride ?? undefined, sexConstant }) };
  })();

  async function saveBody(recalculate: boolean) {
    const age = parseDecimal(ageText);
    const heightCm = resolveHeight();
    const weightKg = resolveWeight();
    const bodyFat = fatText.trim() === '' ? null : parseDecimal(fatText);
    const checks = [validateAge(age), validateHeightCm(heightCm), validateWeightKg(weightKg), validateBodyFat(bodyFat)];
    const failed = checks.find((check) => !check.ok);
    if (failed || age == null || heightCm == null || weightKg == null) {
      setError(failed?.message ?? 'Check the fields.');
      return;
    }
    const plan = buildMacroPlan({ sex, age, heightCm, weightKg, bodyFatPct: bodyFat, activity, goal, pregnant, formula: formulaOverride ?? undefined, sexConstant });
    if (goal === 'cut' && !plan.goalAllowed) {
      setError(plan.goalBlockReason);
      return;
    }
    const targets = !profile.targets.custom || recalculate
      ? { kcal: plan.kcal, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG, fiberG: plan.fiberG, custom: false }
      : profile.targets;
    const message = profile.targets.custom && !recalculate ? 'Profile saved. Custom targets were kept.' : 'Profile saved and targets recalculated.';
    const ok = await onSave({
      ...profile,
      sex,
      age,
      heightCm,
      weightKg,
      bodyFatPct: bodyFat,
      activity,
      goal: plan.goal,
      pregnant,
      formula: plan.formula,
      formulaOverride,
      sexConstant: sex === 'unspecified' ? sexConstant : null,
      targets,
    }, message);
    if (!ok) {
      setError('Could not save. Your profile was not changed.');
      return;
    }
    setError(null);
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText variant="section">Body</AppText>
      <GroupLabel>Sex</GroupLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {(['female', 'male', 'unspecified'] as Sex[]).map((option) => (
          <Chip key={option} label={option === 'unspecified' ? 'Unspecified' : option === 'female' ? 'Female' : 'Male'} selected={sex === option} onPress={() => setSex(option)} />
        ))}
      </View>
      <SexConstantPicker sex={sex} value={sexConstant} onChange={setSexConstant} />
      <Field label="Age" value={ageText} onChangeText={setAgeText} keyboard="number" />
      {profile.units === 'metric' ? (
        <Field label="Height" value={heightText} onChangeText={setHeightText} suffix="cm" />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Feet" value={heightText} onChangeText={setHeightText} keyboard="number" /></View>
          <View style={{ flex: 1 }}><Field label="Inches" value={inchText} onChangeText={setInchText} /></View>
        </View>
      )}
      <Field label="Weight" value={weightText} onChangeText={setWeightText} suffix={profile.units === 'metric' ? 'kg' : 'lb'} />
      <Field label="Body fat % (optional)" value={fatText} onChangeText={setFatText} />
      {previewPlan ? <FormulaPicker plan={previewPlan.plan} bodyFatEntered={previewPlan.bodyFat != null} onChange={setFormulaOverride} /> : null}
      <GroupLabel>Activity level</GroupLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {(Object.keys(ACTIVITY_DETAILS) as ActivityLevel[]).map((level) => (
          <Chip key={level} label={ACTIVITY_DETAILS[level].label} detail={ACTIVITY_DETAILS[level].description} selected={activity === level} onPress={() => setActivity(level)} />
        ))}
      </View>
      <GroupLabel>Goal</GroupLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {(Object.keys(GOAL_DETAILS) as Goal[]).map((option) => (
          <Chip key={option} label={GOAL_DETAILS[option].label} selected={goal === option} onPress={() => setGoal(option)} />
        ))}
      </View>
      <SwitchRow label="Pregnant or breastfeeding" value={pregnant} onValueChange={setPregnant} />
      {error ? <AppText variant="caption" color={theme.colors.warningText}>{error}</AppText> : null}
      <PrimaryButton label={profile.targets.custom ? 'Save body, keep targets' : 'Save and recalculate'} onPress={() => saveBody(false)} />
      {profile.targets.custom ? <SecondaryButton label="Recalculate targets from these stats" onPress={() => saveBody(true)} /> : null}
    </Card>
  );
}

function TargetEditor({
  profile,
  onSave,
  onNotice,
}: {
  profile: Profile;
  onSave: (profile: Profile, message?: string) => Promise<boolean>;
  /** Called with null when the user edits a field, so a stale 'saved' banner goes away. */
  onNotice: (message: string | null) => void;
}) {
  const theme = useTheme();
  const [kcal, setKcal] = useState(String(profile.targets.kcal));
  const [protein, setProtein] = useState(String(profile.targets.proteinG));
  const [carbs, setCarbs] = useState(String(profile.targets.carbsG));
  const [fat, setFat] = useState(String(profile.targets.fatG));
  const [issues, setIssues] = useState<string[]>([]);
  const mountedTargets = useRef(false);
  useEffect(() => {
    if (mountedTargets.current) onNotice(null);
    mountedTargets.current = true;
    setIssues([]);
  }, [kcal, protein, carbs, fat, onNotice]);

  const plan = buildMacroPlan({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
    activity: profile.activity,
    goal: profile.goal,
    pregnant: profile.pregnant,
    formula: profile.formulaOverride ?? undefined,
    sexConstant: profile.sexConstant,
  });
  const liveNotices = targetNotices({
    kcal: parseDecimal(kcal),
    proteinG: parseDecimal(protein),
    carbsG: parseDecimal(carbs),
    fatG: parseDecimal(fat),
  });
  const energy = (parseDecimal(protein) ?? 0) * 4 + (parseDecimal(carbs) ?? 0) * 4 + (parseDecimal(fat) ?? 0) * 9;

  async function saveTargets() {
    const draft = {
      kcal: parseDecimal(kcal),
      proteinG: parseDecimal(protein),
      carbsG: parseDecimal(carbs),
      fatG: parseDecimal(fat),
    };
    const review = assessTargets(draft, profile.sex, plan.bmr, profile.weightKg, plan.tdee, profile.goal);
    const liveMessages = new Set(liveNotices.map((notice) => notice.message));
    setIssues(review.issues.map((issue) => issue.message).filter((message) => !liveMessages.has(message)));
    if (review.blocking || draft.kcal == null || draft.proteinG == null || draft.carbsG == null || draft.fatG == null) return;
    await onSave({
      ...profile,
      targets: { kcal: draft.kcal, proteinG: draft.proteinG, carbsG: draft.carbsG, fatG: draft.fatG, fiberG: plan.fiberG, custom: true },
    }, 'Targets saved.');
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText variant="section">Targets</AppText>
      <Field label="Calories" value={kcal} onChangeText={setKcal} suffix="kcal" />
      <Field label="Protein" value={protein} onChangeText={setProtein} suffix="g" />
      <Field label="Carbs" value={carbs} onChangeText={setCarbs} suffix="g" />
      <Field label="Fat" value={fat} onChangeText={setFat} suffix="g" />
      <AppText variant="caption" color={theme.colors.textSecondary}>
        These grams add up to {Math.round(energy)} kcal.
      </AppText>
      {liveNotices.map((notice) => (
        <AppText key={notice.message} variant="caption" color={theme.colors.warningText} accessibilityRole="alert" testID={`notice-${notice.field}`}>{notice.message}</AppText>
      ))}
      {issues.map((issue) => (
        <AppText key={issue} variant="caption" color={theme.colors.warningText}>{issue}</AppText>
      ))}
      <PrimaryButton label="Save targets" onPress={saveTargets} testID="save-targets" />
    </Card>
  );
}

function imperialParts(profile: Profile): { feet: number; inches: number } {
  return normalizeFeetInches(0, profile.heightCm / 2.54);
}

function initialHeight(profile: Profile): string {
  if (profile.units === 'metric') return String(profile.heightCm);
  return String(imperialParts(profile).feet);
}

function initialInches(profile: Profile): string {
  return formatAmount(imperialParts(profile).inches);
}

function initialWeight(profile: Profile): string {
  return profile.units === 'metric' ? String(profile.weightKg) : formatAmount(profile.weightKg / 0.45359237);
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
