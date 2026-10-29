import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';
import { AppText } from './ui';
import { useTheme } from '../state/AppContext';
import { formatKcal } from '../lib/format';

export function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const theme = useTheme();
  const size = Math.min(theme.sizes.calorieRing, 220);
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? consumed / target : 0;
  const over = target > 0 && consumed > target;
  const color = over ? theme.colors.warning : theme.colors.primary;
  const dash = target > 0 ? Math.min(1, Math.max(0, ratio)) * circumference : 0;
  const remaining = target - consumed;
  return (
    <View
      style={{ alignItems: 'center', gap: theme.spacing.sm }}
      accessible
      accessibilityLabel={target > 0 ? `${formatKcal(consumed)} of ${formatKcal(target)} kilocalories` : `${formatKcal(consumed)} kilocalories, no target set`}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ transform: [{ rotate: '-90deg' }] }}>
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
            {dash > 0 ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
        </View>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <AppText variant="heroNumber">{formatKcal(consumed)}</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>/ {formatKcal(target)} kcal</AppText>
        </View>
      </View>
      <AppText variant="bodyMedium" color={over ? theme.colors.warningText : theme.colors.textSecondary}>
        {target <= 0 ? 'Set a calorie target in Profile' : over ? `${formatKcal(consumed - target)} over` : `${formatKcal(Math.max(0, remaining))} left`}
      </AppText>
    </View>
  );
}
