import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/src/components/ui';
import { useTheme } from '@/src/state/AppContext';
import { useI18n } from '@/src/i18n/react';

export default function NotFound() {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md, backgroundColor: theme.colors.background }}>
        <AppText variant="section">{t('notFound.message')}</AppText>
        <Link href="/(tabs)">
          <AppText color={theme.colors.primary}>{t('notFound.back')}</AppText>
        </Link>
      </View>
    </>
  );
}
