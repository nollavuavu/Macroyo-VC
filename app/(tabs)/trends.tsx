import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { addDays, friendlyDate, localDateISO, shortDate, weekdayNarrow } from '@/src/lib/dates';
import { displayKcal } from '@/src/lib/domain';
import { formatAmount, formatFixed, formatKcal } from '@/src/lib/format';
import { useI18n } from '@/src/i18n/react';
import { mean, trailingAverage } from '@/src/lib/stats';
import { borders, borderStrong, insetRect, overBarPaint } from '@/src/theme/extras';
import { chartTextProps } from '@/src/theme/chartText';
import { useApp, useTheme } from '@/src/state/AppContext';
import { AppText, Card, Screen, Segmented } from '@/src/components/ui';

type Range = '7' | '30' | '90' | 'all';

export default function TrendsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
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
    kcal: data.logs.filter((entry) => entry.date === iso).reduce((sum, entry) => sum + displayKcal(entry.kcal), 0),
  }));
  const target = data.profile?.targets.kcal ?? 0;
  const maxCal = Math.max(target, ...calories.map((day) => day.kcal), 1);

  return (
    <Screen testID="screen-trends">
      <AppText variant="title">{t('trends.title')}</AppText>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: t('trends.range.7') },
          { value: '30', label: t('trends.range.30') },
          { value: '90', label: t('trends.range.90') },
          { value: 'all', label: t('trends.range.all') },
        ]}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">{t('trends.weight')}</AppText>
        {stats.length === 0 ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            {t('trends.weightEmpty')}
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
              {stats.length > 1 ? `${t('trends.weightLegend')} ` : ''}
              {stats.length > 1
                ? t('trends.weightLatestChange', {
                    weight: formatAmount(stats[stats.length - 1].weightKg),
                    date: friendlyDate(stats[stats.length - 1].date, today),
                    change: formatAmount(stats[stats.length - 1].weightKg - stats[0].weightKg),
                  })
                : t('trends.weightLatest', {
                    weight: formatAmount(stats[stats.length - 1].weightKg),
                    date: friendlyDate(stats[stats.length - 1].date, today),
                  })}
            </AppText>
          </>
        )}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section">{t('trends.calories')}</AppText>
        {calories.every((day) => day.kcal === 0) ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            {t('trends.caloriesEmpty')}
          </AppText>
        ) : (
          <CalorieBars
            values={calories.map((day) => day.kcal)}
            dates={calories.map((day) => day.date)}
            target={target}
            max={maxCal}
            fill={theme.colors.primary}
            grid={theme.colors.border}
            axis={borderStrong(theme)}
            text={theme.colors.textSecondary}
            line={theme.colors.textPrimary}
          />
        )}
        <AppText variant="caption" color={theme.colors.textSecondary}>
          {t('trends.caloriesCaption', {
            range: t(range === '7' ? 'trends.last7' : range === '30' ? 'trends.last30' : 'trends.recent'),
            target: formatKcal(target),
            average: averageLogged(calories.map((day) => day.kcal)) != null
              ? t('trends.caloriesAverage', { avg: formatKcal(averageLogged(calories.map((day) => day.kcal)) ?? 0) })
              : '',
          })}
        </AppText>
      </Card>
      <Card style={{ gap: theme.spacing.xs }}>
        <AppText variant="section">{t('trends.bodyNumbers')}</AppText>
        {stats.length === 0 ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>{t('trends.bodyEmpty')}</AppText>
        ) : (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            {[
              t('trends.bmiValue', { value: formatFixed(stats[stats.length - 1].bmi, 1) }),
              stats[stats.length - 1].ffmi != null
                ? t('trends.ffmiValue', { value: formatFixed(stats[stats.length - 1].ffmi ?? 0, 1) })
                : t('trends.ffmiNeeds'),
              stats[stats.length - 1].normalizedFfmi != null
                ? t('trends.normalizedValue', { value: formatFixed(stats[stats.length - 1].normalizedFfmi ?? 0, 1) })
                : null,
            ].filter(Boolean).join(' · ')}
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
  const { t } = useI18n();
  const labelProps = chartTextProps(useTheme());
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
      accessibilityLabel={t('trends.weightChartLabel', { count: values.length, from: formatAmount(first), to: formatAmount(last) })}
    >
      <Line x1={PAD_L} y1={PAD_T} x2={CHART_W - PAD_R} y2={PAD_T} stroke={grid} strokeWidth="1" />
      <Line x1={PAD_L} y1={PAD_T + plotH} x2={CHART_W - PAD_R} y2={PAD_T + plotH} stroke={axis} strokeWidth="1" />
      <SvgText x={PAD_L - 6} y={PAD_T + 4} {...labelProps} fill={text} textAnchor="end">{formatAmount(max)}</SvgText>
      <SvgText x={PAD_L - 6} y={PAD_T + plotH + 4} {...labelProps} fill={text} textAnchor="end">{formatAmount(min)}</SvgText>
      <SvgText x={PAD_L} y={CHART_H - 6} {...labelProps} fill={text} textAnchor="start">{shortDate(dates[0])}</SvgText>
      {values.length > 1 ? (
        <SvgText x={CHART_W - PAD_R} y={CHART_H - 6} {...labelProps} fill={text} textAnchor="end">{shortDate(dates[dates.length - 1])}</SvgText>
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
  grid: string;
  axis: string;
  text: string;
  line: string;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const labelProps = chartTextProps(theme);
  const gap = 4;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const barWidth = Math.max(4, (plotW - gap * (values.length - 1)) / values.length);
  const paint = overBarPaint(theme, barWidth);
  const yAt = (value: number) => PAD_T + plotH - (value / max) * plotH;
  const avg = averageLogged(values);
  const labelEvery = values.length <= 7 ? 1 : Math.ceil(values.length / 6);
  return (
    <Svg
      width="100%"
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      accessible
      accessibilityLabel={target > 0
        ? t('trends.caloriesChartLabelTarget', { count: values.length, target: formatKcal(target) })
        : t('trends.caloriesChartLabel', { count: values.length })}
    >
      <Line x1={PAD_L} y1={PAD_T + plotH} x2={CHART_W - PAD_R} y2={PAD_T + plotH} stroke={axis} strokeWidth="1" />
      <SvgText x={PAD_L - 6} y={PAD_T + plotH + 4} {...labelProps} fill={text} textAnchor="end">0</SvgText>
      <SvgText x={PAD_L - 6} y={PAD_T + 4} {...labelProps} fill={text} textAnchor="end">{formatKcal(max)}</SvgText>
      {values.map((value, index) => {
        const x = PAD_L + index * (barWidth + gap);
        const barHeight = Math.max(0, (value / max) * plotH);
        const label = index % labelEvery === 0 ? (values.length <= 7 ? weekdayNarrow(dates[index]) : shortDate(dates[index])) : null;
        const bar = { x, y: PAD_T + plotH - barHeight, width: barWidth, height: barHeight };
        const isOver = target > 0 && value > target;
        return (
          <G key={index}>
            {isOver ? (
              <>
                {paint.outline ? <Rect {...bar} rx="3" fill={paint.outline} /> : null}
                {/* The outline is the bar's own outer edge; the fill sits inside it, so the footprint never grows. */}
                <Rect {...(paint.outline ? insetRect(bar, borders.emphasis) : bar)} rx={paint.outline ? '1.5' : '3'} fill={paint.fill} />
              </>
            ) : (
              <Rect {...bar} rx="3" fill={fill} />
            )}
            {label ? (
              <SvgText x={x + barWidth / 2} y={CHART_H - 8} {...labelProps} fill={text} textAnchor="middle">{label}</SvgText>
            ) : null}
          </G>
        );
      })}
      {target > 0 ? <Line x1={PAD_L} y1={yAt(target)} x2={CHART_W - PAD_R} y2={yAt(target)} stroke={line} strokeWidth="1.5" /> : null}
      {avg != null ? <Line x1={PAD_L} y1={yAt(avg)} x2={CHART_W - PAD_R} y2={yAt(avg)} stroke={line} strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity={0.7} /> : null}
    </Svg>
  );
}
