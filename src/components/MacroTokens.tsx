import { View } from 'react-native';
import { macroOrder } from '@/src/theme/theme';
import { formatAmount } from '@/src/lib/format';
import { useTheme } from '@/src/state/AppContext';
import { AppText } from './ui';

const LETTER = { protein: 'P', carbs: 'C', fat: 'F' } as const;
const WORD = { protein: 'protein', carbs: 'carbs', fat: 'fat' } as const;

/** Three inline "● P 43g" tokens in P/C/F order, dot in the macro fill and text in the AA-safe text colour. */
export function MacroTokens({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const theme = useTheme();
  const values = { protein, carbs, fat };
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md }}
      accessible
      accessibilityLabel={macroOrder.map((key) => `${WORD[key]} ${formatAmount(values[key], 0)} grams`).join(', ')}
    >
      {macroOrder.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.macroColors[key] }} />
          <AppText variant="macroGrams" color={theme.macroTextColors[key]}>
            {LETTER[key]} {formatAmount(values[key], 0)}g
          </AppText>
        </View>
      ))}
    </View>
  );
}
