import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/src/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <AppText variant="section">That screen is not in Macroyo.</AppText>
        <Link href="/(tabs)">
          <AppText color="#0E6B5C">Back to Today</AppText>
        </Link>
      </View>
    </>
  );
}
