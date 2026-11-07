import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

const PIECE_COLORS = [colors.yellow, colors.coral, colors.mint, '#FFFFFF', colors.purpleTint];

/**
 * Celebration confetti: one generous burst of large pieces that fall through the top of the
 * screen and fade (about 2.5 s), then rest; `loop` keeps it drifting instead. Respects reduced
 * motion (renders a static sprinkle). Decorative only (aria-hidden).
 */
export function Confetti({ count = 48, height = 520, loop = false }: { count?: number; height?: number; loop?: boolean }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: ((i * 53) % 100) as number,
        size: 10 + ((i * 7) % 11),
        color: PIECE_COLORS[i % PIECE_COLORS.length]!,
        delay: (i * 97) % 900,
        duration: 2000 + ((i * 211) % 900),
        round: i % 3 === 0,
      })),
    [count],
  );
  return (
    <View aria-hidden pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: 'hidden' }]}>
      {pieces.map((p, i) => (
        <Piece key={i} {...p} height={height} reduced={reduced} loop={loop} />
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
  loop,
}: {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  round: boolean;
  height: number;
  reduced: boolean;
  loop: boolean;
}) {
  const t = useSharedValue(reduced ? 0.4 : 0);
  useEffect(() => {
    if (reduced) return;
    const fall = withTiming(1, { duration, easing: Easing.in(Easing.quad) });
    t.value = withDelay(delay, loop ? withRepeat(fall, -1, false) : fall);
    return () => cancelAnimation(t);
  }, [delay, duration, reduced, loop, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -30 + t.value * (height + 30) }, { rotate: `${t.value * 540}deg` }, { translateX: Math.sin(t.value * 6.28) * 18 }],
    opacity: t.value <= 0 ? 0 : t.value < 0.08 ? t.value * 12.5 : t.value > 0.8 ? (1 - t.value) / 0.2 : 1,
  }));

  return <Animated.View style={[{ position: 'absolute', left: `${left}%`, top: 0, width: size, height: round ? size : size * 0.6, borderRadius: round ? size / 2 : 2, backgroundColor: color }, style]} />;
}
