import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../src/features/theme';
import { BeakerLoader } from '../../src/features/ui/BeakerLoader';
import { Screen } from '../../src/features/ui/Screen';
import { StatusTicker } from '../../src/features/ui/StatusTicker';
import { PLANNING_LINES } from '../../src/features/ui/status-ticker';

/**
 * QA harness: the planning wait (beaker + rotating status lines) with no server and no model.
 *   /dev/planning            new-course lines, 7 s per line (what the intake screen shows)
 *   /dev/planning?tree=1     new-skill-tree lines
 *   /dev/planning?interval=1500   faster rotation for screenshots
 * Pair with a browser's reduce-motion setting to check the static beaker and instant text swaps.
 */
export default function DevPlanningScreen() {
  const params = useLocalSearchParams<{ tree?: string; interval?: string }>();
  const addingTree = params.tree === '1';
  const interval = Number(params.interval) > 0 ? Number(params.interval) : 7000;
  return (
    <Screen scroll={false}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>QA HARNESS · local render, no server</Text>
      </View>
      <View style={styles.planning}>
        <BeakerLoader size={210} />
        <Text style={styles.planningTitle}>{addingTree ? 'Adding a new skill tree…' : 'Mixing up your course…'}</Text>
        <StatusTicker lines={addingTree ? PLANNING_LINES.tree : PLANNING_LINES.course} intervalMs={interval} />
        <Text style={styles.planningText}>
          {addingTree ? 'Pip is planning the new branch and writing its first lesson.' : 'Your first lesson will be ready the moment the path is. About a minute.'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.yellowTint },
  bannerText: { fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.6, color: colors.ink },
  planning: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  planningTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.ink, textAlign: 'center' },
  planningText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
});
