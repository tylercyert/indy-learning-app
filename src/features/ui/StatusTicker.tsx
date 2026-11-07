import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { shouldAnnounce, statusIndexAt } from './status-ticker';

/**
 * Rotates short status lines during a long wait so the screen never looks stuck. One line every
 * `intervalMs`; the last line holds. The visible line cross-fades unless reduce-motion is on, in
 * which case it swaps instantly (text changes are not motion). Assistive tech hears every other
 * line through a polite live region (web, Android) or an announcement (iOS), never every tick.
 */
export function StatusTicker({
  lines,
  intervalMs = 7000,
  announceEvery = 2,
  style,
}: {
  lines: readonly string[];
  intervalMs?: number;
  announceEvery?: number;
  style?: StyleProp<TextStyle>;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  // The live region only changes on announced ticks, so it holds the last announced line.
  const announced = lines[index - (index % Math.max(1, announceEvery))] ?? '';

  useEffect(() => {
    const started = Date.now();
    let shown = 0;
    const timer = setInterval(() => {
      const next = statusIndexAt(Date.now() - started, intervalMs, lines.length);
      if (next !== shown) {
        shown = next;
        if (!reduced) opacity.value = withSequence(withTiming(0, { duration: 160 }), withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
        setIndex(next);
        // iOS has no live regions; announce the same every-other line explicitly.
        if (Platform.OS === 'ios' && shouldAnnounce(next, announceEvery)) AccessibilityInfo.announceForAccessibility(lines[next] ?? '');
      }
      if (next === lines.length - 1) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [intervalMs, lines, reduced, opacity, announceEvery]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.wrap}>
      <Animated.Text aria-hidden style={[styles.line, style, fade]} numberOfLines={2}>
        {lines[index] ?? ''}
      </Animated.Text>
      {/* Read by assistive tech only; stays in the tree so the live region exists before it changes. */}
      <Text accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.srOnly}>
        {announced}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', minHeight: 24 },
  line: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.purple, textAlign: 'center' },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
