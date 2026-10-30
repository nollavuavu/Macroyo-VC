import { Calculator, House, TrendingUp, UserRound, Utensils } from 'lucide-react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';
import type { TabRoute } from '../lib/tabs';
import { icons, strokes } from '../theme/extras';

/**
 * Tab bar icon. Inactive: the outline icon. Active: a filled icon, for every tab.
 * Lucide fills House, Utensils and UserRound cleanly. Calculator and TrendingUp would lose their detail
 * (keys, the line) under a plain fill, so their active forms are drawn here with the detail cut out in `knockout`.
 */
export function TabIcon({ route, color, focused, knockout, size = icons.nav }: { route: TabRoute; color: ColorValue; focused: boolean; knockout: string; size?: number }) {
  const strokeWidth = focused ? strokes.tabActive : strokes.regular;
  const fill = focused ? color : 'none';
  if (route === 'index') return <House color={color} size={size} strokeWidth={strokeWidth} fill={fill} />;
  if (route === 'log') return <Utensils color={color} size={size} strokeWidth={strokeWidth} fill={fill} />;
  if (route === 'profile') return <UserRound color={color} size={size} strokeWidth={strokeWidth} fill={fill} />;
  if (route === 'calc') {
    if (!focused) return <Calculator color={color} size={size} strokeWidth={strokeWidth} />;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-calc-filled">
        <Rect x={4} y={2} width={16} height={20} rx={3} fill={color} />
        <Rect x={7.5} y={5.5} width={9} height={4} rx={1} fill={knockout} />
        {[8.5, 12, 15.5].flatMap((x) => [13.5, 17.5].map((y) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={knockout} />))}
      </Svg>
    );
  }
  if (route === 'trends') {
    if (!focused) return <TrendingUp color={color} size={size} strokeWidth={strokeWidth} />;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" testID="tab-icon-trends-filled">
        <Path d="M2.5 18 9 11.5l4 4L21.5 7v13.5h-19z" fill={color} />
        <Path d="M2.5 18 9 11.5l4 4L21.5 7" fill="none" stroke={color} strokeWidth={strokes.tabActive} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 7h5.5v5.5" fill="none" stroke={color} strokeWidth={strokes.tabActive} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return null;
}

