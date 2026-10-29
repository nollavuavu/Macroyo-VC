import { View } from 'react-native';
import type { BmrFormula, MacroPlan, Sex, SexConstantChoice } from '@/src/lib/domain';
import { AppText, Chip, Segmented } from '@/src/components/ui';
import { useTheme } from '@/src/state/AppContext';

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
  if (sex !== 'unspecified') return null;
  return (
    <View style={{ gap: theme.spacing.sm }} testID="sex-constant-picker">
      <AppText variant="caption" color={theme.colors.textSecondary}>
        {value == null
          ? 'Sex is unspecified, so an average formula is used (Mifflin–St Jeor with a −78 constant). You can pick the male or female constant instead. The calorie floor stays 1,500 kcal.'
          : `You chose the ${value} constant (${value === 'male' ? '+5' : '−161'}) for Mifflin–St Jeor. The calorie floor stays 1,500 kcal.`}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <Chip label="Average (−78)" selected={value == null} onPress={() => onChange(null)} />
        <Chip label="Male (+5)" selected={value === 'male'} onPress={() => onChange('male')} />
        <Chip label="Female (−161)" selected={value === 'female'} onPress={() => onChange('female')} />
      </View>
    </View>
  );
}

/** Shows which BMR formula is active, with its BMR, and lets the user switch when body fat is entered. */
export function FormulaPicker({
  plan,
  bodyFatEntered,
  onChange,
}: {
  plan: Pick<MacroPlan, 'formula' | 'formulaNote' | 'bmr'>;
  bodyFatEntered: boolean;
  onChange: (value: BmrFormula) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }} testID="formula-picker">
      <AppText variant="caption" color={theme.colors.textSecondary}>
        {plan.formulaNote} BMR {Math.round(plan.bmr)} kcal.
      </AppText>
      {bodyFatEntered ? (
        <Segmented
          value={plan.formula}
          onChange={onChange}
          options={[{ value: 'katch', label: 'Katch–McArdle' }, { value: 'mifflin', label: 'Mifflin–St Jeor' }]}
        />
      ) : null}
    </View>
  );
}
