import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

const PIECE_COLORS = [colors.yellow, colors.coral, colors.mint, '#FFFFFF', colors.purpleTint];

/**
 * Lightweight celebration: a handful of pieces drift down and fade, looping gently.
 * Respects reduced motion (renders a static sprinkle). Decorative only (aria-hidden).
 */
export function Confetti({ count = 18, height = 320 }: { count?: number; height?: number }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: ((i * 53) % 100) as number,
        size: 8 + ((i * 7) % 8),
        color: PIECE_COLORS[i % PIECE_COLORS.length]!,
        delay: (i * 137) % 1400,
        duration: 2600 + ((i * 211) % 1400),
        round: i % 3 === 0,
      })),
    [count],
  );
  return (
    <View aria-hidden pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: 'hidden' }]}>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} height={height} reduced={reduced} />
      ))}
    </View>
  );
}

function Piece({
  left,
  size,
  color,
  delay,
  duration,
  round,
  height,
  reduced,
}: {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  round: boolean;
  height: number;
  reduced: boolean;
}) {
  const t = useSharedValue(reduced ? 0.4 : 0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [delay, duration, reduced, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -20 + t.value * (height + 20) }, { rotate: `${t.value * 540}deg` }, { translateX: Math.sin(t.value * 6.28) * 14 }],
    opacity: t.value < 0.1 ? t.value * 10 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
  }));

  return <Animated.View style={[{ position: 'absolute', left: `${left}%`, top: 0, width: size, height: round ? size : size * 0.6, borderRadius: round ? size / 2 : 2, backgroundColor: color }, style]} />;
}
