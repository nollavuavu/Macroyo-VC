import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { addDays, localDateISO } from '@/src/lib/dates';
import { formatAmount, formatKcal } from '@/src/lib/format';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, Screen, Segmented } from '@/src/components/ui';

type Range = '7' | '30' | '90' | 'all';

export default function TrendsScreen() {
  const theme = useTheme();
  const { data } = useApp();
  const [range, setRange] = useState<Range>('7');
  const today = localDateISO();
  const cutoff = range === 'all' ? '0000-01-01' : addDays(today, -(Number(range) - 1));

  const stats = useMemo(
    () => data.bodyStats.filter((stat) => stat.date >= cutoff).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [cutoff, data.bodyStats],
  );
  const days = useMemo(() => {
    const count = range === 'all' ? 14 : Number(range);
    const start = range === 'all' ? addDays(today, -13) : cutoff;
    return Array.from({ length: Math.min(count, 30) }, (_, index) => addDays(start, index)).filter((iso) => iso <= today);
  }, [cutoff, range, today]);
  const calories = days.map((iso) => ({
    date: iso,
    kcal: data.logs.filter((entry) => entry.date === iso).reduce((sum, entry) => sum + entry.kcal, 0),
  }));
  const target = data.profile?.targets.kcal ?? 0;
  const maxCal = Math.max(target, ...calories.map((day) => day.kcal), 1);

  return (
    <Screen testID="screen-trends">
      <AppText variant="title">Trends</AppText>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7D' },
          { value: '30', label: '30D' },
          { value: '90', label: '90D' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">Weight</AppText>
        {stats.length === 0 ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            Save a weigh-in from Calc and a line will show up here. One entry is enough to start.
          </AppText>
        ) : (
          <>
            <WeightChart values={stats.map((stat) => stat.weightKg)} color={theme.colors.primary} grid={theme.colors.border} />
            <AppText variant="caption" color={theme.colors.textSecondary}>
              Latest {formatAmount(stats[stats.length - 1].weightKg)} kg on {stats[stats.length - 1].date}
              {stats.length > 1 ? ` · change ${formatAmount(stats[stats.length - 1].weightKg - stats[0].weightKg)} kg in this range` : ''}
            </AppText>
          </>
        )}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">Calories</AppText>
        {calories.every((day) => day.kcal === 0) ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            Log a few meals and the bars will compare each day with your target.
          </AppText>
        ) : (
          <CalorieBars
            values={calories.map((day) => day.kcal)}
            target={target}
            max={maxCal}
            fill={theme.colors.primary}
            over={theme.colors.warning}
            grid={theme.colors.border}
          />
        )}
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {range === '7' ? 'Last 7 days' : range === '30' ? 'Last 30 days, chart shows up to 30' : 'Recent days'} · target {formatKcal(target)} kcal. Bars turn amber when a day is over target.
        </AppText>
      </Card>
      <Card style={{ gap: theme.spacing.xs }}>
        <AppText variant="section">Latest body numbers</AppText>
        {stats.length === 0 ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>BMI and FFMI show up after you save from Calc.</AppText>
        ) : (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            BMI {formatAmount(stats[stats.length - 1].bmi)}
            {stats[stats.length - 1].ffmi != null ? ` · FFMI ${formatAmount(stats[stats.length - 1].ffmi ?? 0)}` : ' · FFMI needs a body-fat entry'}
            {stats[stats.length - 1].normalizedFfmi != null ? ` · normalized ${formatAmount(stats[stats.length - 1].normalizedFfmi ?? 0)}` : ''}
          </AppText>
        )}
      </Card>
    </Screen>
  );
}

function WeightChart({ values, color, grid }: { values: number[]; color: string; grid: string }) {
  const width = 320;
  const height = 140;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 16) + 8;
    const y = height - 12 - ((value - min) / span) * (height - 24);
    return `${x},${y}`;
  }).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1="8" y1={height - 12} x2={width - 8} y2={height - 12} stroke={grid} strokeWidth="1" />
      <Polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function CalorieBars({
  values,
  target,
  max,
  fill,
  over,
  grid,
}: {
  values: number[];
  target: number;
  max: number;
  fill: string;
  over: string;
  grid: string;
}) {
  const width = 320;
  const height = 140;
  const gap = 4;
  const barWidth = Math.max(4, (width - 16 - gap * values.length) / values.length);
  const targetY = height - 12 - (target / max) * (height - 24);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {target > 0 ? <Line x1="8" y1={targetY} x2={width - 8} y2={targetY} stroke={grid} strokeWidth="1" strokeDasharray="4 4" /> : null}
      {values.map((value, index) => {
        const barHeight = Math.max(0, (value / max) * (height - 24));
        const x = 8 + index * (barWidth + gap);
        const y = height - 12 - barHeight;
        return <Rect key={index} x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={target > 0 && value > target ? over : fill} />;
      })}
    </Svg>
  );
}
