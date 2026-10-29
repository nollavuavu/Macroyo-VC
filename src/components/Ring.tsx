import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';
import { AppText } from './ui';
import { warningBoundary } from '../theme/extras';
import { useTheme } from '../state/AppContext';
import { useI18n } from '../i18n/react';
import { formatKcal, withUnit } from '../lib/format';
import { remainingDisplay } from '../lib/domain';

export function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const size = Math.min(theme.sizes.calorieRing, 220);
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Everything below comes from the same whole numbers, so the ring, total and remaining always agree.
  const shown = remainingDisplay(consumed, target);
  const ratio = shown.target > 0 ? shown.consumed / shown.target : 0;
  const over = shown.target > 0 && shown.kind === 'over';
  const color = over ? warningBoundary(theme) : theme.colors.primary;
  const dash = target > 0 ? Math.min(1, Math.max(0, ratio)) * circumference : 0;
  return (
    <View
      style={{ alignItems: 'center', gap: theme.spacing.sm }}
      accessible
      accessibilityLabel={target > 0 ? t('ring.a11y', { consumed: formatKcal(shown.consumed), target: formatKcal(shown.target) }) : t('ring.a11yNoTarget', { consumed: formatKcal(shown.consumed) })}
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
          <AppText variant="heroNumber">{formatKcal(shown.consumed)}</AppText>
          <AppText variant="secondary" color={theme.colors.textSecondary}>{`/ ${withUnit(formatKcal(shown.target), 'kcal')}`}</AppText>
        </View>
      </View>
      <AppText variant="bodyMedium" color={over ? theme.colors.warningText : theme.colors.textSecondary}>
        {target <= 0 ? t('ring.setTarget') : over ? t('ring.over', { amount: formatKcal(shown.amount) }) : t('ring.left', { amount: formatKcal(shown.amount) })}
      </AppText>
    </View>
  );
}
