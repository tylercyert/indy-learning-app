import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

/**
 * The one progress object that fills: a chunky glass whose liquid rises as required lessons are
 * completed. Drawn with plain Views (like the beaker), animated on the UI thread. The fraction is
 * the accessible label; the picture is decorative for assistive tech.
 */
export function ProgressGlass({
  completed,
  required,
  width = 72,
  height = 120,
  liquid = colors.coral,
  showCount = true,
  label,
}: {
  completed: number;
  required: number;
  width?: number;
  height?: number;
  liquid?: string;
  showCount?: boolean;
  /** Overrides the default "{completed} of {required} lessons done" label. */
  label?: string;
}) {
  const reduced = useReducedMotion();
  const ratio = required > 0 ? Math.min(1, completed / required) : 0;
  const fill = useSharedValue(reduced ? ratio : 0);
  useEffect(() => {
    fill.value = reduced ? ratio : withTiming(ratio, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [ratio, reduced, fill]);
  const border = Math.max(3, Math.round(width / 18));
  const innerH = height - border * 2;
  const liquidStyle = useAnimatedStyle(() => ({ height: Math.max(0, innerH * fill.value) }));
  const bubbleSize = Math.max(4, Math.round(width / 9));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `${completed} of ${required} lessons done`}
      aria-valuemin={0}
      aria-valuemax={required}
      aria-valuenow={completed}
      style={{ width, alignItems: 'center', gap: 4 }}
    >
      <View style={[styles.glass, { width, height, borderWidth: border, borderRadius: Math.round(width / 4), borderTopLeftRadius: Math.round(width / 9), borderTopRightRadius: Math.round(width / 9) }]}>
        <Animated.View style={[styles.liquid, { backgroundColor: liquid }, liquidStyle]}>
          {[0.25, 0.55, 0.78].map((x, i) => (
            <View
              key={i}
              aria-hidden
              style={{
                position: 'absolute',
                left: (width - border * 2) * x - bubbleSize / 2,
                bottom: 6 + i * (innerH * 0.18),
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: bubbleSize / 2,
                backgroundColor: 'rgba(255,255,255,0.75)',
              }}
            />
          ))}
        </Animated.View>
        {/* Rim highlight */}
        <View aria-hidden style={[styles.shine, { left: border + 3, top: border + 6, width: Math.max(3, border), height: innerH * 0.35 }]} />
      </View>
      {showCount ? (
        <Text aria-hidden style={[styles.count, { fontSize: Math.max(12, Math.round(width / 5)) }]}>
          {completed}/{required}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderColor: colors.ink, backgroundColor: '#FFFFFF', overflow: 'hidden', justifyContent: 'flex-end' },
  liquid: { width: '100%' },
  shine: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(31,21,53,0.12)' },
  count: { fontFamily: fonts.black, color: colors.ink },
});
