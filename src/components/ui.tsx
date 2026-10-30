import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { TriangleAlert, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, useTheme } from '../state/AppContext';
import { useI18n } from '../i18n/react';
import { borderStrong, borders, icons, marks, screenBottomPadding, snackbarGeometry, strokes, warningBoundary } from '../theme/extras';
import { fitTextProps } from '../lib/fitLabel';
import type { Theme, TypographyKey } from '../theme/theme';

export { DISCLAIMER } from '../lib/copy';
import { DISCLAIMER } from '../lib/copy';

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  fit,
  testID,
  accessibilityRole,
}: {
  /** Shrinks the text down to 80% on native (two lines on web) instead of clipping: labels in fixed-width controls. */
  fit?: boolean;
  testID?: string;
  accessibilityRole?: 'alert' | 'text';
  variant?: TypographyKey;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const { locale } = useI18n();
  return (
    <Text
      testID={testID}
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={2}
      // `fit`: shrink to 80% on native, wrap to two lines on web (react-native-web has no font shrinking).
      {...(fit ? fitTextProps(Platform.OS) : { numberOfLines })}
      // Finnish compounds are long: let Android hyphenate at the soft hyphens in the catalog (iOS and web already do).
      android_hyphenationFrequency={locale === 'fi' ? 'normal' : undefined}
      style={[theme.typography[variant], { color: color ?? theme.colors.textPrimary }, style]}
    >
      {children}
    </Text>
  );
}

/** The part of a ScrollView that screens use to bring a warning into view. */
export type Scroller = ComponentRef<typeof ScrollView>;

export function Screen({
  children,
  scroll = true,
  testID,
  fabClearance = false,
  bottomClearance,
  belowTabBar = true,
  scrollRef,
}: {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
  /** Adds FAB height + margin of bottom padding so the end of the scroll clears a floating button. */
  fabClearance?: boolean;
  /** A minimum bottom padding, for another floating element (the undo snackbar). */
  bottomClearance?: number;
  /** True (default) for the tab screens: the navigator already keeps the tab bar and the bottom inset out of the way. */
  belowTabBar?: boolean;
  /** Lets a screen scroll a warning into view. */
  scrollRef?: Ref<Scroller>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      testID={testID}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: screenBottomPadding(theme, { insetBottom: insets.bottom, belowTabBar, fabClearance, minimum: bottomClearance }),
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

/**
 * Shows save/read failures from the app store. Retry is the main action; when stored data was unreadable it also
 * offers the explicit erase, styled as a destructive secondary button so the two are never mistaken for each other.
 * The notice can be dismissed. That only hides this card: writes stay blocked in the store, and the next failed
 * action shows the notice again.
 */
export function StorageBanner() {
  const theme = useTheme();
  const { t, tm } = useI18n();
  const { error, noticeVisible, readFailed, resetAll, retry, dismissError } = useApp();
  if (!error || !noticeVisible) return null;
  return (
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
      <WarningNotice framed testID="storage-banner" onDismiss={dismissError} actions={(
        <>
          <SecondaryButton label={t('storage.retry')} onPress={() => { void retry(); }} testID="storage-retry" />
          {readFailed ? (
            <SecondaryButton label={t('storage.eraseUnreadable')} onPress={() => { void resetAll(); }} testID="reset-unreadable" tone="destructive" />
          ) : null}
        </>
      )}>
        {tm(error)}
      </WarningNotice>
    </View>
  );
}

/**
 * A floating snackbar anchored above the tab bar (see `snackbarGeometry`), so a short-lived notice with one action,
 * like "Removed X. Undo", is visible however long the list behind it is. Render it as a sibling after a Screen inside
 * a flex-1 wrapper. It is announced politely as a status (live region) and never takes focus. `onHold`/`onRelease`
 * come from the action button (press-in or focus, and their end), so the owner can pause its auto-dismiss timer.
 */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onHold,
  onRelease,
  belowTabBar = true,
  testID,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onHold?: () => void;
  onRelease?: () => void;
  belowTabBar?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { bottom } = snackbarGeometry(theme, { insetBottom: insets.bottom, belowTabBar });
  return (
    <View
      testID={testID}
      role="status"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      style={{
        position: 'absolute',
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        bottom,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.card,
        borderWidth: borders.thin,
        borderColor: borderStrong(theme),
        backgroundColor: theme.colors.surface,
        ...theme.shadows.floating,
      }}
    >
      <AppText style={{ flex: 1 }}>{message}</AppText>
      <SecondaryButton label={actionLabel} onPress={onAction} onHold={onHold} onRelease={onRelease} testID={testID ? `${testID}-action` : undefined} />
    </View>
  );
}

/**
 * A small standing entry for a storage problem that is still there after the card above was dismissed (a failed
 * save, or stored data that could not be read: writes stay blocked until it is fixed). Shown on Profile, so Retry and
 * Erase remain reachable. Erase asks for a second tap, like the Erase button in the Data card. While the card
 * itself is showing it renders nothing, so the two are never on screen together.
 */
export function StorageProblem() {
  const { t, tm } = useI18n();
  const { error, noticeVisible, readFailed, resetAll, retry } = useApp();
  const [confirming, setConfirming] = useState(false);
  if (!error || noticeVisible) return null;
  return (
    <WarningNotice framed testID="storage-problem" actions={(
      <>
        <SecondaryButton label={t('storage.retry')} onPress={() => { void retry(); }} testID="storage-problem-retry" />
        {readFailed && !confirming ? (
          <SecondaryButton label={t('storage.eraseUnreadable')} onPress={() => setConfirming(true)} testID="storage-problem-erase" tone="destructive" />
        ) : null}
        {readFailed && confirming ? (
          <>
            <WarningLine>{t('profile.eraseWarning')}</WarningLine>
            <PrimaryButton label={t('storage.eraseUnreadable')} onPress={() => { void resetAll(); }} testID="storage-problem-erase-confirm" />
            <SecondaryButton label={t('common.cancel')} onPress={() => setConfirming(false)} />
          </>
        ) : null}
      </>
    )}>
      {t('storage.problem')} {tm(error)}
    </WarningNotice>
  );
}

/**
 * An amber warning that is never colour-only: a warning icon and body text in warningText (4.96:1 on white).
 * `framed` is the stand-alone card (outlined in warningText, on the surface colour) used for storage problems;
 * the default is an inline callout with a leading bar, used inside forms. `actions` render under the text.
 */
export function WarningNotice({
  children,
  framed = false,
  actions,
  testID,
  onLayout,
  onDismiss,
  variant = 'secondary',
}: {
  children: ReactNode;
  framed?: boolean;
  actions?: ReactNode;
  testID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Adds a close button. Dismissing hides the notice only; it never clears the problem behind it. */
  onDismiss?: () => void;
  variant?: TypographyKey;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const color = warningBoundary(theme);
  return (
    <View
      accessibilityRole="alert"
      testID={testID}
      onLayout={onLayout}
      style={framed
        ? { backgroundColor: theme.colors.surface, borderColor: color, borderWidth: borders.emphasis, borderRadius: theme.radii.card, padding: theme.spacing.lg, gap: theme.spacing.md }
        : { borderLeftColor: color, borderLeftWidth: theme.spacing.xs, paddingLeft: theme.spacing.md, gap: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        <TriangleAlert color={color} size={icons.md} strokeWidth={strokes.nav} />
        <AppText variant={variant} color={theme.colors.warningText} style={{ flex: 1 }}>{children}</AppText>
        {onDismiss ? (
          <Pressable
            testID={testID ? `${testID}-dismiss` : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            onPress={onDismiss}
            hitSlop={theme.spacing.sm}
            style={{ width: theme.sizes.minTouchTarget, height: theme.sizes.minTouchTarget, marginTop: -theme.spacing.md, marginRight: -theme.spacing.md, marginBottom: -theme.spacing.md, alignItems: 'center', justifyContent: 'center' }}
          >
            <X color={theme.colors.warningText} size={icons.md} strokeWidth={strokes.nav} />
          </Pressable>
        ) : null}
      </View>
      {actions}
    </View>
  );
}

/**
 * A single amber caption line with the warning icon, for hints and blockers that are not a full notice.
 * Colour alone is not a signal (WCAG 1.4.1), and the amber border of a field is not there for captions that
 * stand alone, so the icon makes them read as warnings. Text uses warningText, the icon the warning boundary.
 */
export function WarningLine({
  children,
  testID,
  onLayout,
  style,
}: {
  children: ReactNode;
  testID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="alert" testID={testID} onLayout={onLayout} style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }, style]}>
      <View style={{ height: theme.typography.caption.lineHeight, justifyContent: 'center' }}>
        <TriangleAlert color={warningBoundary(theme)} size={icons.sm} strokeWidth={strokes.nav} />
      </View>
      <AppText variant="caption" color={theme.colors.warningText} style={{ flex: 1 }}>{children}</AppText>
    </View>
  );
}

export function Card({ children, style, onLayout }: { children: ReactNode; style?: StyleProp<ViewStyle>; onLayout?: (event: LayoutChangeEvent) => void }) {
  const theme = useTheme();
  return (
    <View
      onLayout={onLayout}
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
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="button" style={{ textAlign: 'center' }} color={disabled ? theme.colors.textSecondary : theme.colors.onAccent}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  testID,
  tone = 'default',
  onHold,
  onRelease,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  /** Press-in or focus (and its end below): lets a timer pause while the button is being used. */
  onHold?: () => void;
  onRelease?: () => void;
  /** `destructive` is for actions that erase data: an amber outline and amber label, clearly not the default button. */
  tone?: 'default' | 'destructive';
}) {
  const theme = useTheme();
  const destructive = tone === 'destructive';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onHold}
      onPressOut={onRelease}
      onFocus={onHold}
      onBlur={onRelease}
      style={({ pressed }) => ({
        minHeight: theme.sizes.minTouchTarget,
        borderRadius: theme.radii.button,
        borderWidth: destructive ? borders.emphasis : borders.thin,
        borderColor: destructive ? warningBoundary(theme) : theme.colors.border,
        backgroundColor: destructive ? 'transparent' : theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText variant="button" style={{ textAlign: 'center' }} color={destructive ? theme.colors.warningText : theme.colors.primary}>
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
        maxWidth: '100%',
        backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
        borderWidth: borders.thin,
        borderColor: selected ? theme.colors.accent : borderStrong(theme),
        opacity: disabled ? 0.45 : 1,
        justifyContent: 'center',
      }}
    >
      <AppText variant="bodyMedium" fit color={selected ? theme.colors.onAccent : theme.colors.textPrimary}>
        {label}
      </AppText>
      {detail ? (
        <AppText variant="caption" numberOfLines={2} color={selected ? theme.colors.onAccent : theme.colors.textSecondary}>
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
        borderWidth: borders.thin,
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
              paddingHorizontal: theme.spacing.xs,
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              opacity: option.disabled ? 0.4 : 1,
            }}
          >
            <AppText variant="secondary" fit color={selected ? theme.colors.primary : theme.colors.textSecondary} style={{ fontFamily: theme.fontFamilies.bodyMedium, textAlign: 'center' }}>
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
  onLayout,
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
  /** Reports where the field sits, so a screen can scroll to the first invalid one. */
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderWidth = focused ? borders.focus : borders.thin;
  return (
    <View onLayout={onLayout} style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {labelColor ? <View style={{ width: marks.dot, height: marks.dot, borderRadius: marks.dot / 2, backgroundColor: labelColor }} /> : null}
        <AppText variant="secondary" color={theme.colors.textSecondary}>
          {label}
        </AppText>
      </View>
      <View
        style={{
          minHeight: theme.sizes.inputHeight,
          borderRadius: theme.radii.button,
          borderWidth,
          borderColor: error ? warningBoundary(theme) : focused ? theme.colors.primary : borderStrong(theme),
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          // Keep the text in place when the border grows from 1 to 2.
          paddingHorizontal: theme.spacing.lg - (borderWidth - borders.thin),
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
          inputMode={keyboard === 'default' ? 'text' : keyboard === 'number' ? 'numeric' : 'decimal'}
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
      style={{ height: marks.dot, borderRadius: theme.radii.pill, backgroundColor: theme.colors.border, overflow: 'hidden' }}
    >
      <View style={{ width: width * clamped, height: marks.dot, borderRadius: theme.radii.pill, backgroundColor: color }} />
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
