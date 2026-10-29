import { Redirect, Tabs } from 'expo-router';
import { Calculator, House, TrendingUp, UserRound, Utensils } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';

export default function TabLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { ready, data } = useApp();
  if (!ready) return null;
  if (!data.profile?.onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: theme.sizes.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: theme.spacing.xs + theme.spacing.xxs,
        },
        // Labels stay one line at any system font size: the tab bar is a fixed-height control (Dynamic Type 200% would truncate them).
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontFamily: theme.fontFamilies.bodyMedium,
          fontSize: theme.typography.caption.fontSize,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarButtonTestID: 'tab-today',
          tabBarIcon: ({ color, focused }) => <House color={color} size={22} strokeWidth={focused ? 2.6 : 2} fill={focused ? color : 'none'} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t('tabs.log'),
          tabBarButtonTestID: 'tab-log',
          tabBarIcon: ({ color, focused }) => <Utensils color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="calc"
        options={{
          title: t('tabs.calc'),
          tabBarButtonTestID: 'tab-calc',
          tabBarIcon: ({ color, focused }) => <Calculator color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: t('tabs.trends'),
          tabBarButtonTestID: 'tab-trends',
          tabBarIcon: ({ color, focused }) => <TrendingUp color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, focused }) => <UserRound color={color} size={22} strokeWidth={focused ? 2.6 : 2} fill={focused ? color : 'none'} />,
        }}
      />
    </Tabs>
  );
}
