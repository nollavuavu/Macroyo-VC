import { Redirect, Tabs } from 'expo-router';
import { Calculator, House, TrendingUp, UserRound, Utensils } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useTheme } from '@/src/state/AppContext';

export default function TabLayout() {
  const theme = useTheme();
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
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamilies.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarButtonTestID: 'tab-today',
          tabBarIcon: ({ color, focused }) => <House color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarButtonTestID: 'tab-log',
          tabBarIcon: ({ color, focused }) => <Utensils color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="calc"
        options={{
          title: 'Calc',
          tabBarButtonTestID: 'tab-calc',
          tabBarIcon: ({ color, focused }) => <Calculator color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarButtonTestID: 'tab-trends',
          tabBarIcon: ({ color, focused }) => <TrendingUp color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, focused }) => <UserRound color={color} size={22} strokeWidth={focused ? 2.6 : 2} />,
        }}
      />
    </Tabs>
  );
}
