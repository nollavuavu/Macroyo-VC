import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { addDays, friendlyDate, localDateISO, shortDate, weekdayShort } from '@/src/lib/dates';
import { formatAmount, formatKcal } from '@/src/lib/format';
import { mean, trailingAverage } from '@/src/lib/stats';
import { borderStrong } from '@/src/theme/extras';
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
            No weigh-ins yet. Save one from Calc (Body → Save to progress) and your trend line starts here. One entry is enough.
          </AppText>
        ) : (
          <>
            <WeightChart
              values={stats.map((stat) => stat.weightKg)}
              dates={stats.map((stat) => stat.date)}
              color={theme.colors.primary}
              grid={theme.colors.border}
              axis={borderStrong(theme)}
              text={theme.colors.textSecondary}
            />
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {stats.length > 1 ? 'Dots are weigh-ins; the thin line is a 7-entry trailing average. ' : ''}
              Latest {formatAmount(stats[stats.length - 1].weightKg)} kg · {friendlyDate(stats[stats.length - 1].date, today)}
              {stats.length > 1 ? ` · change ${formatAmount(stats[stats.length - 1].weightKg - stats[0].weightKg)} kg in this range` : ''}
            </AppText>
          </>
        )}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">Calories</AppText>
        {calories.every((day) => day.kcal === 0) ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            No meals logged in this range. Log a few and each day shows up as a bar against your target.
          </AppText>
        ) : (
          <CalorieBars
            values={calories.map((day) => day.kcal)}
            dates={calories.map((day) => day.date)}
            target={target}
            max={maxCal}
            fill={theme.colors.primary}
            over={theme.colors.warning}
            grid={theme.colors.border}
            axis={borderStrong(theme)}
            text={theme.colors.textSecondary}
            line={theme.colors.textPrimary}
          />
        )}
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {range === '7' ? 'Last 7 days' : range === '30' ? 'Last 30 days, chart shows up to 30' : 'Recent days'} · target {formatKcal(target)} kcal (solid line){averageLogged(calories.map((day) => day.kcal)) != null ? ` · average ${formatKcal(averageLogged(calories.map((day) => day.kcal)) ?? 0)} kcal on logged days (dashed)` : ''}. Bars turn amber when a day is over target.
        </AppText>
      </Card>
      <Card style={{ gap: theme.spacing.xs }}>
        <AppText variant="section">Latest body numbers</AppText>
        {stats.length === 0 ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>BMI and FFMI show up after you save from Calc.</AppText>
        ) : (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            BMI {stats[stats.length - 1].bmi.toFixed(1)}
            {stats[stats.length - 1].ffmi != null ? ` · FFMI ${(stats[stats.length - 1].ffmi ?? 0).toFixed(1)}` : ' · FFMI needs a body-fat entry'}
            {stats[stats.length - 1].normalizedFfmi != null ? ` · normalized ${(stats[stats.length - 1].normalizedFfmi ?? 0).toFixed(1)}` : ''}
          </AppText>
        )}
      </Card>
    </Screen>
  );
}

function averageLogged(values: number[]): number | null {
  return mean(values.filter((value) => value > 0));
}

const CHART_W = 320;
const CHART_H = 160;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 26;

function WeightChart({
  values,
  dates,
  color,
  grid,
  axis,
  text,
}: {
  values: number[];
  dates: string[];
  color: string;
  grid: string;
  axis: string;
  text: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const xAt = (index: number) => (values.length === 1 ? PAD_L + plotW / 2 : PAD_L + (index / (values.length - 1)) * plotW);
  const yAt = (value: number) => PAD_T + plotH - ((value - min) / span) * plotH;
  const averages = trailingAverage(values, 7);
  const points = (list: number[]) => list.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ');
  const first = values[0];
  const last = values[values.length - 1];
  return (
    <Svg
      width="100%"
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      accessible
      accessibilityLabel={`Weight chart, ${values.length} weigh-ins from ${formatAmount(first)} to ${formatAmount(last)} kilograms`}
    >
      <Line x1={PAD_L} y1={PAD_T} x2={CHART_W - PAD_R} y2={PAD_T} stroke={grid} strokeWidth="1" />
      <Line x1={PAD_L} y1={PAD_T + plotH} x2={CHART_W - PAD_R} y2={PAD_T + plotH} stroke={axis} strokeWidth="1" />
      <SvgText x={PAD_L - 6} y={PAD_T + 4} fontSize="11" fill={text} textAnchor="end">{formatAmount(max)}</SvgText>
      <SvgText x={PAD_L - 6} y={PAD_T + plotH + 4} fontSize="11" fill={text} textAnchor="end">{formatAmount(min)}</SvgText>
      <SvgText x={PAD_L} y={CHART_H - 6} fontSize="11" fill={text} textAnchor="start">{shortDate(dates[0])}</SvgText>
      {values.length > 1 ? (
        <SvgText x={CHART_W - PAD_R} y={CHART_H - 6} fontSize="11" fill={text} textAnchor="end">{shortDate(dates[dates.length - 1])}</SvgText>
      ) : null}
      {values.length > 1 ? <Polyline points={points(values)} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {values.length > 1 ? <Polyline points={points(averages)} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {values.map((value, index) => (
        <Circle key={index} cx={xAt(index)} cy={yAt(value)} r={values.length > 30 ? 2 : 3.5} fill={color} />
      ))}
    </Svg>
  );
}

function CalorieBars({
  values,
  dates,
  target,
  max,
  fill,
  over,
  grid,
  axis,
  text,
  line,
}: {
  values: number[];
  dates: string[];
  target: number;
  max: number;
  fill: string;
  over: string;
  grid: string;
  axis: string;
  text: string;
  line: string;
}) {
  const gap = 4;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const barWidth = Math.max(4, (plotW - gap * (values.length - 1)) / values.length);
  const yAt = (value: number) => PAD_T + plotH - (value / max) * plotH;
  const avg = averageLogged(values);
  const labelEvery = values.length <= 7 ? 1 : Math.ceil(values.length / 6);
  return (
    <Svg
      width="100%"
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      accessible
      accessibilityLabel={`Calories per day for ${values.length} days${target > 0 ? `, target ${formatKcal(target)}` : ''}`}
    >
      <Line x1={PAD_L} y1={PAD_T + plotH} x2={CHART_W - PAD_R} y2={PAD_T + plotH} stroke={axis} strokeWidth="1" />
      <SvgText x={PAD_L - 6} y={PAD_T + plotH + 4} fontSize="11" fill={text} textAnchor="end">0</SvgText>
      <SvgText x={PAD_L - 6} y={PAD_T + 4} fontSize="11" fill={text} textAnchor="end">{formatKcal(max)}</SvgText>
      {values.map((value, index) => {
        const x = PAD_L + index * (barWidth + gap);
        const barHeight = Math.max(0, (value / max) * plotH);
        const label = index % labelEvery === 0 ? (values.length <= 7 ? weekdayShort(dates[index]).slice(0, 1) : shortDate(dates[index])) : null;
        return (
          <G key={index}>
            <Rect x={x} y={PAD_T + plotH - barHeight} width={barWidth} height={barHeight} rx="3" fill={target > 0 && value > target ? over : fill} />
            {label ? (
              <SvgText x={x + barWidth / 2} y={CHART_H - 8} fontSize="11" fill={text} textAnchor="middle">{label}</SvgText>
            ) : null}
          </G>
        );
      })}
      {target > 0 ? <Line x1={PAD_L} y1={yAt(target)} x2={CHART_W - PAD_R} y2={yAt(target)} stroke={line} strokeWidth="1.5" /> : null}
      {avg != null ? <Line x1={PAD_L} y1={yAt(avg)} x2={CHART_W - PAD_R} y2={yAt(avg)} stroke={line} strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity={0.7} /> : null}
    </Svg>
  );
}
