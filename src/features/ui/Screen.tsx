import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';
import { BeakerLoader } from './BeakerLoader';
import { ChunkyButton } from './ChunkyButton';

/**
 * Reading surfaces live in one centered column so tablets and desktops keep a readable measure
 * (about 70–80 characters) instead of stretching edge to edge. Backgrounds stay full-bleed.
 */
export const CONTENT_MAX_WIDTH = 680;

export function Column({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function Screen({
  children,
  scroll = true,
  footer,
  scrollToEndKey,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  /** When this value changes, the scroll view scrolls to its end (chat-style screens). */
  scrollToEndKey?: unknown;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (scrollToEndKey === undefined) return;
    const t = setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [scrollToEndKey]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView ref={ref} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Column>{children}</Column>
        </ScrollView>
      ) : (
        <Column style={{ flex: 1 }}>{children}</Column>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.footerColumn}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function BackButton({ label = 'Back', onPress }: { label?: string; onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={styles.back}
    >
      <Text style={styles.backText}>‹</Text>
    </Pressable>
  );
}

export function Loading({ message, size = 150 }: { message: string; size?: number }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <BeakerLoader size={size} label={message} />
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
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: -4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  error: { padding: 16, borderRadius: 20, backgroundColor: colors.coralTint, gap: 10 },
  errorTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  errorText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  eyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontFamily: fonts.black, fontSize: 30, lineHeight: 35, color: colors.ink },
});
