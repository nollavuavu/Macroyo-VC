import { useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/AppContext';
import type { Theme, TypographyKey } from '../theme/theme';

export const DISCLAIMER =
  'Not medical advice. This app provides general information, not medical advice. Estimates can be off by 10% or more. Consult a qualified professional before changing your diet.';

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: TypographyKey;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
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
}: {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
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
        paddingBottom: insets.bottom + theme.sizes.tabBarHeight + theme.spacing.xxxl,
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
      {body}
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
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  detail?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{
        minHeight: theme.sizes.minTouchTarget,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
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
        borderColor: theme.colors.border,
        padding: 3,
        gap: 3,
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
              minHeight: 40,
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  suffix?: string;
  placeholder?: string;
  keyboard?: 'decimal' | 'default' | 'number';
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="secondary" color={theme.colors.textSecondary}>
        {label}
      </AppText>
      <View
        style={{
          minHeight: theme.sizes.inputHeight,
          borderRadius: theme.radii.button,
          borderWidth: 1,
          borderColor: error ? theme.colors.warning : theme.colors.border,
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType={keyboard === 'default' ? 'default' : keyboard === 'number' ? 'number-pad' : 'decimal-pad'}
          inputMode={keyboard === 'default' ? 'text' : 'decimal'}
          style={[
            theme.typography.body,
            { flex: 1, color: theme.colors.textPrimary, paddingVertical: theme.spacing.md },
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

export function Disclaimer() {
  const theme = useTheme();
  return (
    <AppText variant="caption" color={theme.colors.textSecondary}>
      {DISCLAIMER}
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
