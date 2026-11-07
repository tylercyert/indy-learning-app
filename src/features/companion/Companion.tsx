import { StyleSheet, View } from 'react-native';
import type { CompanionMood, CompanionThemeV1 } from '../../contracts';
import { colors } from '../theme';

/**
 * The companion, drawn with plain views so it works on every platform without an SVG dependency.
 * Body and cheek colors come from the validated theme; eyes and mouth are always ink.
 * Headpiece and prop rendering lands with the visual polish slice; the theme already carries them.
 */
export function Companion({ theme, mood = 'happy', size = 96 }: { theme: CompanionThemeV1; mood?: CompanionMood; size?: number }) {
  const s = size / 96;
  const eyeOffset = mood === 'curious' ? 2 * s : 0;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${theme.name}, your companion, ${mood}`}
      style={{ width: size, height: size * 1.08, alignItems: 'center', justifyContent: 'flex-end' }}
    >
      {mood === 'cheering' && (
        <>
          <View style={[styles.arm, { backgroundColor: theme.bodyColor, width: 14 * s, height: 40 * s, left: 2 * s, top: 10 * s, transform: [{ rotate: '25deg' }] }]} />
          <View style={[styles.arm, { backgroundColor: theme.bodyColor, width: 14 * s, height: 40 * s, right: 2 * s, top: 10 * s, transform: [{ rotate: '-25deg' }] }]} />
        </>
      )}
      <View style={{ width: 72 * s, height: 72 * s, borderRadius: 36 * s, backgroundColor: theme.bodyColor, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 10 * s, marginTop: -4 * s }}>
          <Eye s={s} offset={eyeOffset} squint={mood === 'cheering'} />
          <Eye s={s} offset={eyeOffset} squint={mood === 'cheering'} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 60 * s, position: 'absolute', top: 40 * s }}>
          <View style={{ width: 9 * s, height: 9 * s, borderRadius: 5 * s, backgroundColor: theme.cheekColor }} />
          <View style={{ width: 9 * s, height: 9 * s, borderRadius: 5 * s, backgroundColor: theme.cheekColor }} />
        </View>
        <Mouth s={s} mood={mood} />
      </View>
    </View>
  );
}

function Eye({ s, offset, squint }: { s: number; offset: number; squint: boolean }) {
  if (squint) return <View style={{ width: 14 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: colors.ink, marginTop: 6 * s }} />;
  return (
    <View style={{ width: 16 * s, height: 16 * s, borderRadius: 8 * s, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, backgroundColor: colors.ink, transform: [{ translateX: offset }] }} />
    </View>
  );
}

function Mouth({ s, mood }: { s: number; mood: CompanionMood }) {
  if (mood === 'thinking') return <View style={{ width: 16 * s, height: 3.5 * s, borderRadius: 2 * s, backgroundColor: colors.ink, marginTop: 10 * s }} />;
  if (mood === 'cheering')
    return <View style={{ width: 28 * s, height: 16 * s, borderBottomLeftRadius: 14 * s, borderBottomRightRadius: 14 * s, backgroundColor: colors.ink, marginTop: 6 * s }} />;
  return (
    <View
      style={{
        width: 22 * s,
        height: 11 * s,
        borderBottomLeftRadius: 11 * s,
        borderBottomRightRadius: 11 * s,
        borderWidth: 3.5 * s,
        borderTopWidth: 0,
        borderColor: colors.ink,
        marginTop: 6 * s,
      }}
    />
  );
}

const styles = StyleSheet.create({
  arm: { position: 'absolute', borderRadius: 999 },
});
