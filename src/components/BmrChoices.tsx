import { View } from 'react-native';
import type { BmrFormula, MacroPlan, Sex, SexConstantChoice } from '@/src/lib/domain';
import { AppText, Chip, Segmented } from '@/src/components/ui';
import { useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';

/** Shown only when sex is unspecified: says an average formula is used and lets the user pick a constant. */
export function SexConstantPicker({
  sex,
  value,
  onChange,
}: {
  sex: Sex | null;
  value: SexConstantChoice | null;
  onChange: (value: SexConstantChoice | null) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  if (sex !== 'unspecified') return null;
  return (
    <View style={{ gap: theme.spacing.sm }} testID="sex-constant-picker">
      <AppText variant="caption" color={theme.colors.textSecondary}>
        {value == null ? t('sexConstant.average') : t(value === 'male' ? 'sexConstant.chosenMale' : 'sexConstant.chosenFemale')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <Chip label={t('sexConstant.chipAverage')} selected={value == null} onPress={() => onChange(null)} />
        <Chip label={t('sexConstant.chipMale')} selected={value === 'male'} onPress={() => onChange('male')} />
        <Chip label={t('sexConstant.chipFemale')} selected={value === 'female'} onPress={() => onChange('female')} />
      </View>
    </View>
  );
}

/** Shows which BMR formula is active, with its BMR, and lets the user switch when body fat is entered. */
export function FormulaPicker({
  plan,
  bodyFatEntered,
  onChange,
  hideBmr = false,
}: {
  plan: Pick<MacroPlan, 'formula' | 'formulaNote' | 'bmr'>;
  bodyFatEntered: boolean;
  onChange: (value: BmrFormula) => void;
  /** True while an input is invalid (Calc, age cleared): the formula and BMR line would be stale, so it is not shown. */
  hideBmr?: boolean;
}) {
  const theme = useTheme();
  const { t, tm } = useI18n();
  return (
    <View style={{ gap: theme.spacing.sm }} testID="formula-picker">
      {hideBmr ? null : (
        <AppText variant="caption" color={theme.colors.textSecondary} testID="formula-bmr-line">
          {tm(plan.formulaNote)} {t('formula.bmr', { bmr: Math.round(plan.bmr) })}
        </AppText>
      )}
      {bodyFatEntered ? (
        <Segmented
          value={plan.formula}
          onChange={onChange}
          options={[{ value: 'katch', label: t('formula.katch') }, { value: 'mifflin', label: t('formula.mifflin') }]}
        />
      ) : null}
    </View>
  );
}
