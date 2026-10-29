import { View } from 'react-native';
import { macroOrder } from '@/src/theme/theme';
import { formatAmount, withUnit } from '@/src/lib/format';
import { useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';
import { marks } from '../theme/extras';
import { AppText } from './ui';


/** Three inline "● P 43g" tokens in P/C/F order, dot in the macro fill and text in the AA-safe text colour. */
/** `digits` is 0 for day totals and portions; per-100 g rows pass 1 so 3.6 g of fat is not shown as 4. */
export function MacroTokens({ protein, carbs, fat, digits = 0 }: { protein: number; carbs: number; fat: number; digits?: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const values = { protein, carbs, fat };
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md }}
      accessible
      accessibilityLabel={macroOrder.map((key) => t('macro.a11y', { name: t(`macro.${key}`), grams: formatAmount(values[key], digits) })).join(', ')}
    >
      {macroOrder.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ width: marks.dot, height: marks.dot, borderRadius: marks.dot / 2, backgroundColor: theme.macroColors[key] }} />
          <AppText variant="macroGrams" color={theme.macroTextColors[key]}>
            {t(`macro.letter.${key}`)} {withUnit(formatAmount(values[key], digits), 'g')}
          </AppText>
        </View>
      ))}
    </View>
  );
}
