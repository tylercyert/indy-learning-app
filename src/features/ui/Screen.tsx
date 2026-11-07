import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';
import { ChunkyButton } from './ChunkyButton';

export function Screen({ children, scroll = true, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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

export function Loading({ message }: { message: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
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
  content: { padding: 20, gap: 18, paddingBottom: 32 },
  footer: { padding: 20, paddingTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: -4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  loadingText: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.muted, textAlign: 'center' },
  error: { padding: 16, borderRadius: 20, backgroundColor: colors.coralTint, gap: 10 },
  errorTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  errorText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  eyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontFamily: fonts.black, fontSize: 30, lineHeight: 35, color: colors.ink },
});
