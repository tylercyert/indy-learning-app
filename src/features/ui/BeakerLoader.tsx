import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';

/**
 * Animated loading indicator: a chunky lab beaker in the lower center slowly fills with purple
 * liquid while two test tubes hang above it, tilt inward and pour coral and mint streams into it.
 * Yellow bubbles rise through the liquid. The cycle drains and repeats forever.
 * Drawn with plain Views (no SVG), animated on the UI thread with Reanimated worklets.
 * With reduce-motion enabled the scene is static: beaker half full, tubes upright, no streams.
 */

// One clock drives the pour cycle; keyframes are fractions of CYCLE_MS.
const CYCLE_MS = 4400;
const TILT_IN = [0, 0.14] as const;
const STREAM_ON = [0.12, 0.17] as const;
const FILL = [0.16, 0.76] as const;
const STREAM_OFF = [0.74, 0.8] as const;
const TILT_OUT = [0.78, 0.9] as const;
const DRAIN = [0.88, 1] as const;
const FILL_MIN = 0.12;
const FILL_MAX = 0.85;
const TILT_DEG = 35;
const SIN_TILT = 0.5736;
const COS_TILT = 0.8192;

// Base geometry on a 160-unit canvas; everything is multiplied by size / 160.
const TUBE_W = 22;
const TUBE_L = 58;
const TUBE_TOP = 14;
const TUBE_PIVOT_X = [30, 130] as const;
const BEAKER = { left: 42, top: 78, width: 76, height: 72, border: 4, radius: 18 } as const;
const BEAKER_INNER_H = BEAKER.height - BEAKER.border;
const STREAM_W = 6;
const STREAM_TOP = TUBE_TOP + TUBE_L * COS_TILT;
const STREAM_END = BEAKER.top + BEAKER.height - 8;
const BUBBLES = [
  { x: 12, size: 7, rise: 48, delay: 0, duration: 1700 },
  { x: 30, size: 9, rise: 56, delay: 450, duration: 2100 },
  { x: 48, size: 6, rise: 42, delay: 900, duration: 1500 },
  { x: 58, size: 8, rise: 52, delay: 1300, duration: 1900 },
] as const;

export function BeakerLoader({ size = 160, label }: { size?: number; label?: string }) {
  const s = size / 160;
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const liquidStyle = useAnimatedStyle(() => {
    if (reduced) return { height: 0.5 * BEAKER_INNER_H * s };
    const fill = interpolate(
      t.value,
      [FILL[0], FILL[1], DRAIN[0], DRAIN[1]],
      [FILL_MIN, FILL_MAX, FILL_MAX, FILL_MIN],
      Extrapolation.CLAMP,
    );
    return { height: fill * BEAKER_INNER_H * s };
  }, [reduced, s]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      accessibilityState={{ busy: true }}
      style={styles.wrap}
    >
      <View style={{ width: size, height: size }}>
        <Stream side={0} s={s} t={t} reduced={reduced} color={colors.coral} />
        <Stream side={1} s={s} t={t} reduced={reduced} color={colors.mint} />

        {/* Beaker: open top, flared rim, rounded base. */}
        <View style={[styles.rim, { left: (BEAKER.left - 8) * s, top: (BEAKER.top - 2) * s, width: 14 * s, height: 4 * s }]} />
        <View style={[styles.rim, { right: (160 - BEAKER.left - BEAKER.width - 8) * s, top: (BEAKER.top - 2) * s, width: 14 * s, height: 4 * s }]} />
        <View
          style={{
            position: 'absolute',
            left: BEAKER.left * s,
            top: BEAKER.top * s,
            width: BEAKER.width * s,
            height: BEAKER.height * s,
            borderWidth: BEAKER.border * s,
            borderTopWidth: 0,
            borderColor: colors.ink,
            borderBottomLeftRadius: BEAKER.radius * s,
            borderBottomRightRadius: BEAKER.radius * s,
            overflow: 'hidden',
          }}
        >
          <Animated.View style={[styles.liquid, { backgroundColor: colors.purple }, liquidStyle]}>
            <View style={{ height: 5 * s, backgroundColor: colors.purpleTint }} />
            {BUBBLES.map((b) => (
              <Bubble key={b.x} s={s} reduced={reduced} {...b} />
            ))}
          </Animated.View>
          <View style={[styles.mark, { right: 6 * s, top: 18 * s, width: 9 * s, height: 3 * s }]} />
          <View style={[styles.mark, { right: 6 * s, top: 34 * s, width: 9 * s, height: 3 * s }]} />
          <View style={[styles.glint, { left: 7 * s, top: 14 * s, width: 5 * s, height: 26 * s, borderRadius: 3 * s }]} />
        </View>

        <Tube side={0} s={s} t={t} reduced={reduced} color={colors.coral} />
        <Tube side={1} s={s} t={t} reduced={reduced} color={colors.mint} />
      </View>
      {label ? <Text style={[styles.label, { fontSize: Math.max(13, 15 * s), marginTop: 10 * s }]}>{label}</Text> : null}
    </View>
  );
}

type PartProps = { side: 0 | 1; s: number; t: SharedValue<number>; reduced: boolean; color: string };

/** Test tube hanging mouth-down from its closed end, pivoting at the top so the mouth swings over the beaker. */
function Tube({ side, s, t, reduced, color }: PartProps) {
  const dir = side === 0 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ rotate: '0deg' }] };
    const deg = interpolate(
      t.value,
      [TILT_IN[0], TILT_IN[1], TILT_OUT[0], TILT_OUT[1]],
      [0, dir * TILT_DEG, dir * TILT_DEG, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ rotate: `${deg}deg` }] };
  }, [reduced, dir]);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (TUBE_PIVOT_X[side] - TUBE_W / 2) * s,
          top: TUBE_TOP * s,
          width: TUBE_W * s,
          height: TUBE_L * s,
          transformOrigin: 'top center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          width: TUBE_W * s,
          height: (TUBE_L - 4) * s,
          borderWidth: 4 * s,
          borderBottomWidth: 0,
          borderColor: colors.ink,
          borderTopLeftRadius: (TUBE_W / 2) * s,
          borderTopRightRadius: (TUBE_W / 2) * s,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26 * s, backgroundColor: color }} />
        <View style={[styles.glint, { left: 3 * s, top: 7 * s, width: 3.5 * s, height: 16 * s, borderRadius: 2 * s }]} />
      </View>
      <View style={[styles.rim, { position: 'relative', width: (TUBE_W + 8) * s, height: 4 * s }]} />
    </Animated.View>
  );
}

/** Vertical pour stream from the tilted tube mouth down into the beaker; grows from the mouth, then fades. */
function Stream({ side, s, t, reduced, color }: PartProps) {
  const dir = side === 0 ? 1 : -1;
  const mouthX = TUBE_PIVOT_X[side] + dir * TUBE_L * SIN_TILT;
  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0, transform: [{ scaleY: 0 }] };
    const scaleY = interpolate(t.value, [0, STREAM_ON[0], STREAM_ON[1]], [0, 0, 1], Extrapolation.CLAMP);
    const opacity = interpolate(t.value, [STREAM_OFF[0], STREAM_OFF[1]], [1, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ scaleY }] };
  }, [reduced]);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (mouthX - STREAM_W / 2) * s,
          top: STREAM_TOP * s,
          width: STREAM_W * s,
          height: (STREAM_END - STREAM_TOP) * s,
          borderRadius: (STREAM_W / 2) * s,
          backgroundColor: color,
          transformOrigin: 'top',
        },
        style,
      ]}
    />
  );
}

/** Yellow bubble rising inside the liquid; clipped by the liquid so it never floats above the surface. */
function Bubble({ s, reduced, x, size, rise, delay, duration }: { s: number; reduced: boolean } & (typeof BUBBLES)[number]) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = 0;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(p);
  }, [reduced, p, delay, duration]);
  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0.9, transform: [{ translateY: -rise * 0.4 * s }] };
    return {
      opacity: interpolate(p.value, [0, 0.15, 0.8, 1], [0, 0.9, 0.9, 0], Extrapolation.CLAMP),
      transform: [{ translateY: -p.value * rise * s }, { scale: interpolate(p.value, [0, 1], [0.6, 1]) }],
    };
  }, [reduced, rise, s]);
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x * s, bottom: 4 * s, width: size * s, height: size * s, borderRadius: (size / 2) * s, backgroundColor: colors.yellow },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  rim: { position: 'absolute', backgroundColor: colors.ink, borderRadius: 999 },
  liquid: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  mark: { position: 'absolute', backgroundColor: colors.ink, borderRadius: 2, opacity: 0.6 },
  glint: { position: 'absolute', backgroundColor: '#FFFFFF', opacity: 0.55 },
  label: { fontFamily: fonts.extraBold, color: colors.muted, textAlign: 'center' },
});
