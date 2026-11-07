import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BASE_COMPANION } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors } from '../../src/features/theme';

/**
 * QA harness: the app icon, rendered from the real Poko companion so the Home Screen icon is the
 * same character the learner meets inside. No server and no model.
 *   /dev/icon?size=512&shape=rounded|square|maskable
 * `qa/render-icons.ts` screenshots the `icon` element (after making every ancestor transparent, so
 * the rounded corners stay transparent) and derives the smaller sizes. `maskable` keeps Poko inside
 * the central 80% safe zone that launchers may crop to a circle.
 */
export default function DevIconScreen() {
  const params = useLocalSearchParams<{ size?: string; shape?: string }>();
  const size = Math.max(16, Math.min(1024, Number(params.size ?? 512) || 512));
  const shape = params.shape === 'square' || params.shape === 'maskable' ? params.shape : 'rounded';
  const radius = shape === 'rounded' ? Math.round(size * 0.22) : 0;
  const companionSize = Math.round(size * (shape === 'maskable' ? 0.56 : 0.7));

  return (
    <View style={styles.page}>
      <View testID="icon" style={[styles.icon, { width: size, height: size, borderRadius: radius }]}>
        {/* The companion box leaves headroom for a headpiece; the base Poko has none, so lift it a little. */}
        <Companion theme={BASE_COMPANION} mood="happy" size={companionSize} />
        <View style={{ height: size * 0.06 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start' },
  icon: { backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
