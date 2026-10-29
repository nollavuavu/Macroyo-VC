import { useEffect, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useTheme } from '../state/AppContext';
import { useI18n } from '../i18n/react';
import { borderStrong } from '../theme/extras';
import type { Theme, TypographyKey } from '../theme/theme';

export { DISCLAIMER } from '../lib/copy';
import { DISCLAIMER } from '../lib/copy';

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  testID,
  accessibilityRole,
}: {
  testID?: string;
  accessibilityRole?: 'alert' | 'text';
  variant?: TypographyKey;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      testID={testID}
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={2}
      numberOfLines={numberOfLines}
      style={[theme.typography[variant], { color: color ?? theme.colors.textPrimary }, style]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  testID,
  fabClearance = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
  /** Adds FAB height + 24 of bottom padding so the end of the scroll clears a floating button. */
  fabClearance?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      testID={testID}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: insets.bottom + theme.sizes.tabBarHeight + (fabClearance ? theme.sizes.fab + theme.spacing.xxl : theme.spacing.xxxl),
        gap: theme.spacing.lg,
      }}
    >
      {children}
    </ScrollView>
  ) : (
    <View testID={testID} style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <StorageBanner />
      {body}
    </View>
  );
}

/** Shows save/read failures from the app store. When stored data was unreadable, offers the explicit reset. */
export function StorageBanner() {
  const theme = useTheme();
  const { t, tm } = useI18n();
  const { error, readFailed, resetAll } = useApp();
  if (!error) return null;
  return (
    <View
      accessibilityRole="alert"
      testID="storage-banner"
      style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm }}
    >
      <AppText variant="caption" color={theme.colors.warningText}>{tm(error)}</AppText>
      {readFailed ? (
        <SecondaryButton label={t('storage.eraseUnreadable')} onPress={() => { void resetAll(); }} testID="reset-unreadable" />
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.card,
          padding: theme.spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
        },
        theme.isDark ? null : theme.shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.sizes.buttonHeight,
        borderRadius: theme.radii.button,
        backgroundColor: disabled ? theme.colors.border : theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="button" color={disabled ? theme.colors.textSecondary : theme.colors.onAccent}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.sizes.minTouchTarget,
        borderRadius: theme.radii.button,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText variant="button" color={theme.colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  detail,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  detail?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{
        minHeight: theme.sizes.minTouchTarget,
        // Chips with a second line use the button radius: two-line pills look like blobs.
        borderRadius: detail ? theme.radii.button : theme.radii.pill,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : borderStrong(theme),
        opacity: disabled ? 0.45 : 1,
        justifyContent: 'center',
      }}
    >
      <AppText variant="bodyMedium" color={selected ? theme.colors.onAccent : theme.colors.textPrimary}>
        {label}
      </AppText>
      {detail ? (
        <AppText variant="caption" color={selected ? theme.colors.onAccent : theme.colors.textSecondary}>
          {detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.background,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: borderStrong(theme),
        padding: theme.spacing.xxs,
        gap: theme.spacing.xxs,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!option.disabled }}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: theme.sizes.minTouchTarget,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              opacity: option.disabled ? 0.4 : 1,
            }}
          >
            <AppText variant="secondary" color={selected ? theme.colors.primary : theme.colors.textSecondary} style={{ fontFamily: theme.fontFamilies.bodyMedium }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  suffix,
  placeholder,
  keyboard = 'decimal',
  labelColor,
  accessibilityLabel,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  suffix?: string;
  placeholder?: string;
  keyboard?: 'decimal' | 'default' | 'number';
  /** Optional colour dot before the label (macro colour on Quick add). */
  labelColor?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderWidth = focused ? 2 : 1;
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {labelColor ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: labelColor }} /> : null}
        <AppText variant="secondary" color={theme.colors.textSecondary}>
          {label}
        </AppText>
      </View>
      <View
        style={{
          minHeight: theme.sizes.inputHeight,
          borderRadius: theme.radii.button,
          borderWidth,
          borderColor: error ? theme.colors.warning : focused ? theme.colors.primary : borderStrong(theme),
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          // Keep the text in place when the border grows from 1 to 2.
          paddingHorizontal: theme.spacing.lg - (borderWidth - 1),
        }}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={keyboard === 'default' ? 'default' : keyboard === 'number' ? 'number-pad' : 'decimal-pad'}
          inputMode={keyboard === 'default' ? 'text' : 'decimal'}
          style={[
            theme.typography.body,
            { flex: 1, color: theme.colors.textPrimary, paddingVertical: theme.spacing.md },
            // The wrapper draws the focus ring; suppress the browser outline on web.
            Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null,
          ]}
        />
        {suffix ? (
          <AppText variant="secondary" color={theme.colors.textSecondary}>
            {suffix}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={theme.colors.warningText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** A labelled on/off row with a real Switch and a label that never changes with the value. */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: theme.sizes.minTouchTarget }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium">{label}</AppText>
        {description ? <AppText variant="caption" color={theme.colors.textSecondary}>{description}</AppText> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: borderStrong(theme), true: theme.colors.primary }}
        thumbColor={theme.colors.surface}
      />
    </View>
  );
}

/** Small group heading above a set of chips or fields. */
export function GroupLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <AppText variant="secondary" color={theme.colors.textSecondary} style={{ marginTop: theme.spacing.xs }}>
      {children}
    </AppText>
  );
}

export function Disclaimer() {
  const theme = useTheme();
  const { tm } = useI18n();
  return (
    <AppText variant="caption" color={theme.colors.textSecondary}>
      {tm(DISCLAIMER)}
    </AppText>
  );
}

export function ProgressTrack({
  ratio,
  color,
}: {
  ratio: number;
  color: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}
    >
      <View style={{ width: width * clamped, height: 8, borderRadius: theme.radii.pill, backgroundColor: color }} />
    </View>
  );
}

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function cardShadow(theme: Theme): ViewStyle {
  return theme.isDark ? {} : theme.shadows.card;
}
