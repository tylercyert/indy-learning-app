import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';
import { ChunkyButton } from './ChunkyButton';

/**
 * Reading surfaces live in one centered column so tablets and desktops keep a readable measure
 * (about 70–80 characters) instead of stretching edge to edge. Backgrounds stay full-bleed.
 */
export const CONTENT_MAX_WIDTH = 680;

/** Height of the app bar's content row, below the status-bar inset. The lesson header matches it. */
export const APP_BAR_HEIGHT = 56;

export function Column({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function Screen({
  children,
  scroll = true,
  header,
  footer,
  scrollToEndKey,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** The purple app bar. When present it owns the top safe area (it runs under the status bar). */
  header?: ReactNode;
  footer?: ReactNode;
  /** When this value changes, the scroll view scrolls to its end (chat-style screens). */
  scrollToEndKey?: unknown;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (scrollToEndKey === undefined) return;
    const t = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [scrollToEndKey]);

  // The bottom inset (home indicator) is folded into whatever sits at the bottom, so a tinted footer
  // keeps its color all the way down instead of ending above a white strip.
  const bottomPad = footer ? 0 : insets.bottom;
  return (
    <SafeAreaView style={styles.safe} edges={header ? ['left', 'right'] : ['top', 'left', 'right']}>
      {header}
      {scroll ? (
        <ScrollView ref={ref} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
          <Column>{children}</Column>
        </ScrollView>
      ) : (
        <Column style={{ flex: 1, paddingBottom: 32 + bottomPad }}>{children}</Column>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={[styles.footerColumn, { paddingBottom: 20 + insets.bottom }]}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * The persistent purple bar at the top of every screen. It extends under the iOS status bar (the
 * safe-area inset is padding, so standalone web apps and native both get purple there) and holds the
 * Poko wordmark, or a back/close control when `back` is given. `children` fill the middle (the lesson
 * player puts its progress bar there); `streak` renders the streak chip on the right when > 0, and
 * `right` can replace it with any node.
 */
/**
 * Extra room above the bar's content when the web app runs from the iOS Home Screen (#61). iOS draws
 * a soft blur under its status bar that fades a little way into the page; without this the blur ran
 * into the Poko wordmark on a real iPhone. Trimmed to 6 once the status-bar tint matched the bar
 * (#65). Browser tabs and native builds get no extra room.
 */
const STANDALONE_TOP_CLEARANCE = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
  return standalone ? 6 : 0;
})();

export function AppBar({
  back,
  streak = 0,
  right,
  children,
}: {
  back?: { label: string; onPress?: () => void };
  streak?: number;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.appBar, { paddingTop: insets.top + STANDALONE_TOP_CLEARANCE }]} accessibilityRole="header">
      <View style={styles.appBarRow}>
        {back ? (
          <BackButton label={back.label} onPress={back.onPress} tone="light" />
        ) : (
          <Text style={styles.wordmark} accessibilityRole="header" aria-level={1}>
            Poko
          </Text>
        )}
        {children ? <View style={styles.appBarMiddle}>{children}</View> : <View style={{ flex: 1 }} />}
        {right ?? <StreakChip count={streak} />}
      </View>
    </View>
  );
}

/** The streak, as one small yellow chip. Renders nothing until the learner has a streak. */
export function StreakChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.chip} accessibilityLabel={`${count} day streak`}>
      <Text style={styles.chipText}>🔥 {count}</Text>
    </View>
  );
}

/**
 * The one back control. The glyph is drawn with two rotated bars (no font, no SVG) so it renders the
 * same on web, iOS and Android. `icon="close"` draws an X for screens that dismiss rather than go
 * back (the lesson header); it is inferred from a label that starts with "Close". `tone="light"` is
 * the white-on-purple version for the app bar. Without `onPress`, it goes back when there is history
 * and otherwise home, which is what a standalone web app without browser chrome needs.
 */
export function BackButton({
  label = 'Back',
  onPress,
  icon,
  tone = 'dark',
}: {
  label?: string;
  onPress?: () => void;
  icon?: 'back' | 'close';
  tone?: 'dark' | 'light';
}) {
  const router = useRouter();
  const kind = icon ?? (/^close/i.test(label) ? 'close' : 'back');
  const light = tone === 'light';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={kind === 'close' ? 'Leaves this screen' : 'Goes to the previous screen'}
      hitSlop={6}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={({ pressed }) => [styles.back, light && styles.backLight, pressed && (light ? styles.backLightPressed : styles.backPressed)]}
    >
      {kind === 'close' ? <CloseGlyph light={light} /> : <ChevronGlyph light={light} />}
    </Pressable>
  );
}

const GLYPH_STROKE = 3.5;

/** Left-pointing chevron: two 3.5px bars with round caps meeting at the point, 20px tall. */
function ChevronGlyph({ light }: { light?: boolean }) {
  const arm = 13;
  return (
    <View style={styles.glyphBox} aria-hidden>
      <View style={[styles.glyphBar, light && styles.glyphBarLight, { width: arm, transform: [{ translateX: -1 }, { translateY: -4 }, { rotate: '-45deg' }] }]} />
      <View style={[styles.glyphBar, light && styles.glyphBarLight, { width: arm, transform: [{ translateX: -1 }, { translateY: 4 }, { rotate: '45deg' }] }]} />
    </View>
  );
}

/** X: two 3.5px bars with round caps crossing at the center, 18px across. */
function CloseGlyph({ light }: { light?: boolean }) {
  return (
    <View style={styles.glyphBox} aria-hidden>
      <View style={[styles.glyphBar, light && styles.glyphBarLight, { width: 20, transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.glyphBar, light && styles.glyphBarLight, { width: 20, transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** Plain, quiet loading state. The beaker animation is reserved for course creation. */
export function Loading({ message }: { message: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite" accessibilityRole="progressbar" aria-busy>
      <ActivityIndicator size="large" color={colors.purple} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityLiveRegion="assertive">
      <Text style={styles.errorTitle}>That didn’t work</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <ChunkyButton label="Try again" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function Eyebrow({ children, color = colors.muted }: { children: string; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Title({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 18 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  footerColumn: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 20, paddingTop: 10, gap: 10 },
  appBar: { backgroundColor: colors.purple, borderBottomWidth: 4, borderBottomColor: colors.purpleDeep },
  appBarRow: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', height: APP_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  appBarMiddle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmark: { fontFamily: fonts.black, fontSize: 26, lineHeight: 32, color: '#FFFFFF', letterSpacing: 0.2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.yellow },
  chipText: { fontFamily: fonts.black, fontSize: 14, color: colors.ink },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  backPressed: { backgroundColor: colors.line, transform: [{ scale: 0.94 }] },
  backLight: { backgroundColor: 'rgba(255,255,255,0.18)' },
  backLightPressed: { backgroundColor: 'rgba(255,255,255,0.32)', transform: [{ scale: 0.94 }] },
  glyphBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  glyphBar: { position: 'absolute', height: GLYPH_STROKE, borderRadius: GLYPH_STROKE / 2, backgroundColor: colors.ink },
  glyphBarLight: { backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  loadingText: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.muted, textAlign: 'center' },
  error: { padding: 16, borderRadius: 20, backgroundColor: colors.coralTint, gap: 10 },
  errorTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  errorText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  eyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontFamily: fonts.black, fontSize: 30, lineHeight: 35, color: colors.ink },
});
