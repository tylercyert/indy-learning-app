import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BASE_COMPANION } from '../../src/contracts';
import { CompanionFace } from '../../src/features/companion/Companion';
import { colors } from '../../src/features/theme';

/**
 * QA harness: the app icon, rendered from the real Poko companion so the Home Screen icon is the
 * same character the learner meets inside. No server and no model.
 *   /dev/icon?size=512&shape=rounded|square|maskable|foreground|splash
 * `qa/render-icons.ts` screenshots the `icon` element (after making every ancestor transparent, so
 * the rounded corners stay transparent) and derives the smaller sizes. `maskable` keeps Poko inside
 * the central 80% safe zone that launchers may crop to a circle. `foreground` (Android adaptive icon)
 * and `splash` draw the face on a transparent square: the native config supplies the purple.
 */
export default function DevIconScreen() {
  const params = useLocalSearchParams<{ size?: string; shape?: string }>();
  const size = Math.max(16, Math.min(1024, Number(params.size ?? 512) || 512));
  const shapes = ['rounded', 'square', 'maskable', 'foreground', 'splash'] as const;
  const shape = shapes.find((x) => x === params.shape) ?? 'rounded';
  const radius = shape === 'rounded' ? Math.round(size * 0.22) : 0;
  // Android keeps a 66/108 circle of the adaptive foreground visible on every mask; the face sits inside it.
  const faceShare = { rounded: 0.72, square: 0.72, maskable: 0.58, foreground: 0.54, splash: 0.96 }[shape];
  const faceSize = Math.round(size * faceShare);
  const transparent = shape === 'foreground' || shape === 'splash';

  return (
    <View style={styles.page}>
      <View testID="icon" style={[styles.icon, { width: size, height: size, borderRadius: radius }, transparent && styles.clear]}>
        {/* Owner decision (#61): purple with just Poko's face. */}
        <CompanionFace theme={BASE_COMPANION} mood="happy" size={faceSize} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start' },
  icon: { backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clear: { backgroundColor: 'transparent' },
});
