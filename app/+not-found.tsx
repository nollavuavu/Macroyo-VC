import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/src/components/ui';
import { useTheme } from '@/src/state/AppContext';

export default function NotFound() {
  const theme = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <AppText variant="section">That screen is not in Macroyo.</AppText>
        <Link href="/(tabs)">
          <AppText color={theme.colors.primary}>Back to Today</AppText>
        </Link>
      </View>
    </>
  );
}
