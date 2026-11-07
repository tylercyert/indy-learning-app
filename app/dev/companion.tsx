import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_COMPANION, CompanionHeadpieceSchema, CompanionMoodSchema, CompanionPropSchema, type CompanionThemeV1 } from '../../src/contracts';
import { Companion, describeCompanion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';

/**
 * QA harness: every companion costume on one page, with no server and no model.
 *   /dev/companion
 * Section 1: the three generated instances from the mockup's companion-system board, at the sizes
 * callers use (56, 96, 140). Section 2: the four moods. Section 3: every headpiece x prop at 96.
 * Screenshot it at phone and desktop widths and compare against the mockup.
 */

const MOCKUP: CompanionThemeV1[] = [
  { schemaVersion: 1, name: 'Zest', bodyColor: '#FF7A59', cheekColor: '#FFB4A2', accentColor: '#14B8A6', headpiece: 'sprig', prop: 'umbrella', greeting: "Saturday's getting closer!" },
  { schemaVersion: 1, name: 'Crumb', bodyColor: '#F4C56A', cheekColor: '#FBE3A8', accentColor: '#FFFFFF', headpiece: 'chefHat', prop: 'whisk', greeting: 'Your starter missed you.' },
  { schemaVersion: 1, name: 'Volt', bodyColor: '#22B8CF', cheekColor: '#A5F3FC', accentColor: '#FFC53D', headpiece: 'antenna', prop: 'wrench', greeting: 'Breaker off first.' },
];

const SIZES = [56, 96, 140] as const;
const ACCENTS = ['#14B8A6', '#FFC53D', '#6D28D9', '#FF7A59', '#1F1535', '#FFFFFF', '#34D399', '#C2410C', '#4C1D95', '#0F766E'] as const;

export default function DevCompanionScreen() {
  const headpieces = CompanionHeadpieceSchema.options;
  const props = CompanionPropSchema.options;
  const moods = CompanionMoodSchema.options;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>QA HARNESS · companion costumes, local render</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h2}>Mockup instances at 56 / 96 / 140</Text>
        <View style={styles.row}>
          {MOCKUP.map((theme) => (
            <View key={theme.name} style={styles.card}>
              <View style={[styles.row, { alignItems: 'flex-end' }]}>
                {SIZES.map((size) => (
                  <View key={size} style={styles.box}>
                    <Companion theme={theme} size={size} />
                  </View>
                ))}
              </View>
              <Text style={styles.caption}>{describeCompanion(theme, 'happy')}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Moods (Zest, with costume)</Text>
        <View style={styles.row}>
          {moods.map((mood) => (
            <View key={mood} style={styles.cell}>
              <View style={styles.box}>
                <Companion theme={MOCKUP[0]!} mood={mood} size={96} />
              </View>
              <Text style={styles.label}>{mood}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Every headpiece × prop at 96 (base Poko body, accent varies by row)</Text>
        {headpieces.map((headpiece, i) => (
          <View key={headpiece} style={styles.row}>
            {props.map((prop) => {
              const theme: CompanionThemeV1 = { ...BASE_COMPANION, accentColor: ACCENTS[i % ACCENTS.length]!, headpiece, prop };
              return (
                <View key={prop} style={styles.cell}>
                  <View style={styles.box}>
                    <Companion theme={theme} size={96} />
                  </View>
                  <Text style={styles.label}>
                    {headpiece} · {prop}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  banner: { backgroundColor: colors.yellowTint, paddingVertical: 6, alignItems: 'center' },
  bannerText: { fontFamily: fonts.black, fontSize: 11, letterSpacing: 1, color: '#92400E' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  h2: { fontFamily: fonts.black, fontSize: 16, color: colors.ink, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { padding: 10, borderRadius: 16, backgroundColor: colors.soft, gap: 6 },
  cell: { alignItems: 'center', gap: 4, width: 108 },
  // A dashed box the exact size the component claims (size x size*1.08) shows anything that escapes it.
  box: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignSelf: 'flex-start' },
  label: { fontFamily: fonts.bold, fontSize: 10, color: colors.muted, textAlign: 'center' },
  caption: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, maxWidth: 320 },
});
