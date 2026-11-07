import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

const variants: Record<Variant, { fill: string; shadow: string; text: string; border?: string }> = {
  primary: { fill: colors.yellow, shadow: colors.yellowDeep, text: colors.ink },
  secondary: { fill: colors.purple, shadow: colors.purpleDeep, text: '#FFFFFF' },
  outline: { fill: colors.bg, shadow: '#C4B5FD', text: colors.ink, border: '#C4B5FD' },
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
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={inactive}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.wrap, style, inactive && styles.inactive]}
    >
      <View
        style={[
          styles.face,
          { backgroundColor: v.fill, borderColor: v.border ?? v.fill },
          chunky && { borderBottomWidth: pressed ? 3 : 8, borderBottomColor: v.shadow },
          chunky && pressed && { transform: [{ translateY: 5 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.text} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, { color: v.text }, !chunky && styles.ghostLabel]}>{label}</Text>
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
  label: { fontFamily: fonts.black, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase' },
  ghostLabel: { textTransform: 'none', fontFamily: fonts.extraBold, fontSize: 15, letterSpacing: 0 },
});
