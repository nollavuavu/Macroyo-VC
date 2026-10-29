import { View } from 'react-native';
import { macroOrder } from '@/src/theme/theme';
import { formatAmount } from '@/src/lib/format';
import { useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';
import { AppText } from './ui';


/** Three inline "● P 43g" tokens in P/C/F order, dot in the macro fill and text in the AA-safe text colour. */
export function MacroTokens({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const values = { protein, carbs, fat };
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md }}
      accessible
      accessibilityLabel={macroOrder.map((key) => t('macro.a11y', { name: t(`macro.${key}`), grams: formatAmount(values[key], 0) })).join(', ')}
    >
      {macroOrder.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.macroColors[key] }} />
          <AppText variant="macroGrams" color={theme.macroTextColors[key]}>
            {t(`macro.letter.${key}`)} {formatAmount(values[key], 0)}g
          </AppText>
        </View>
      ))}
    </View>
  );
}
