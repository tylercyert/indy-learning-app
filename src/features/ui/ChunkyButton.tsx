import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

const variants: Record<Variant, { fill: string; shadow: string; text: string; border?: string }> = {
  primary: { fill: colors.yellow, shadow: colors.yellowDeep, text: colors.ink },
  secondary: { fill: colors.purple, shadow: colors.purpleDeep, text: '#FFFFFF' },
  // White face on a white page: the edge is what makes it a button, so it meets 3:1 (WCAG 1.4.11, #20).
  outline: { fill: colors.bg, shadow: colors.control, text: colors.ink, border: colors.control },
  ghost: { fill: 'transparent', shadow: 'transparent', text: colors.muted },
};

export function ChunkyButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  accessibilityHint?: string;
}) {
  const v = variants[variant];
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const chunky = variant !== 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={inactive}
      aria-busy={!!loading}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={inactive}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.wrap, style, !chunky && inactive && styles.inactive]}
    >
      <View
        style={[
          styles.face,
          { backgroundColor: v.fill, borderColor: v.border ?? v.fill },
          chunky && { borderBottomWidth: pressed ? 3 : 8, borderBottomColor: v.shadow },
          // Disabled is a solid, quieter button, never a washed-out one: the shape stays crisp.
          chunky && disabled && !loading && { backgroundColor: colors.line, borderColor: colors.line, borderBottomColor: '#D6D0E8' },
          chunky && pressed && { transform: [{ translateY: 5 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.text} accessibilityLabel={`${label}, working`} />
        ) : (
          <>
            {icon}
            <Text
              // Long or unbreakable labels (a 22-char confirmLabel at 200% text) wrap to two lines or shrink
              // instead of escaping the face; the chunky shape and the disabled colours stay as they are.
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.label, { color: chunky && disabled ? colors.muted : v.text }, !chunky && styles.ghostLabel]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  inactive: { opacity: 0.55 },
  face: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  // flex + minWidth 0 give the label a real width to wrap inside (web breaks an unbreakable word at the edge).
  label: { fontFamily: fonts.black, fontSize: 17, lineHeight: 22, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center', flexShrink: 1, minWidth: 0, paddingVertical: 2 },
  ghostLabel: { textTransform: 'none', fontFamily: fonts.extraBold, fontSize: 15, letterSpacing: 0 },
});
