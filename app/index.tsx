import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BASE_COMPANION } from '../src/contracts';
import { Companion } from '../src/features/companion/Companion';
import { colors, fonts } from '../src/features/theme';
import { ChunkyButton } from '../src/features/ui/ChunkyButton';
import { ProgressGlass } from '../src/features/ui/ProgressGlass';
import { ErrorBox, Eyebrow, Screen } from '../src/features/ui/Screen';
import { useAsync } from '../src/features/ui/useAsync';
import { api, resetLearner } from '../src/services/api';

const EXAMPLES = ['Make great cocktails for a party', 'Learn Indonesian basics', 'Understand how engines work', 'Python for data analysis'];

export default function HomeScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const courses = useAsync(() => api.listCourses(), []);
  const discover = useAsync(() => api.discover(), []);
  const [startingDiscovered, setStartingDiscovered] = useState<string | null>(null);
  const [showAllDiscover, setShowAllDiscover] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const resetAsNewLearner = async () => {
    await resetLearner();
    setResetArmed(false);
    setGoal('');
    setShowAllDiscover(false);
    courses.reload();
    discover.reload();
  };
  /** Home stays short: three recommended courses, the rest behind one tap. */
  const DISCOVER_PREVIEW = 3;

  const startDiscovered = async (courseId: string) => {
    setStartingDiscovered(courseId);
    setStartError(null);
    try {
      const course = await api.startFromDiscovered(courseId);
      router.push({ pathname: '/course/[id]', params: { id: course.course.id } });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start that course');
    } finally {
      setStartingDiscovered(null);
    }
  };

  const start = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setStarting(true);
    setStartError(null);
    try {
      const session = await api.startIntake(trimmed);
      router.push({ pathname: '/intake/[id]', params: { id: session.id } });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not reach the server');
    } finally {
      setStarting(false);
    }
  };

  const streak = courses.data?.streak.count ?? 0;
  // The course to continue: the most recently updated one that is not finished, else the newest.
  const featured = useMemo(() => {
    const list = courses.data?.courses ?? [];
    const active = list.filter((c) => c.course.status !== 'completed');
    return [...(active.length ? active : list)].sort((a, b) => b.course.updatedAt.localeCompare(a.course.updatedAt))[0] ?? null;
  }, [courses.data]);
  const otherCourses = (courses.data?.courses ?? []).filter((c) => c.course.id !== featured?.course.id);

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.brand}>Poko</Text>
          {streak > 0 ? (
            <View style={styles.chip} accessibilityLabel={`${streak} day streak`}>
              <Text style={styles.chipText}>🔥 {streak}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.speech}>
          <Companion theme={featured ? featured.course.companion : BASE_COMPANION} mood={featured ? 'happy' : 'curious'} size={88} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {featured
                ? featured.course.status === 'completed'
                  ? `You finished ${featured.course.title}. Want to go further?`
                  : featured.nextNodeTitle
                    ? `Welcome back! “${featured.nextNodeTitle}” is ready when you are.`
                    : `Welcome back! Your course is ready.`
                : 'Hi, I’m Poko! What do you want to learn?'}
            </Text>
          </View>
        </View>
        {featured ? (
          <View style={styles.continueCard}>
            <ProgressGlass completed={featured.progress.completed} required={featured.progress.required} width={64} height={100} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.continueTitle} numberOfLines={2}>
                {featured.course.title}
              </Text>
              <Text style={styles.continueMeta}>
                {featured.course.status === 'completed' ? 'Completed' : `${featured.progress.completed} of ${featured.progress.required} lessons done`}
              </Text>
            </View>
          </View>
        ) : null}
        {featured ? (
          <ChunkyButton
            label={featured.course.status === 'completed' ? 'Open course' : `Continue · ${featured.nextNodeTitle ?? 'your course'}`}
            onPress={() => router.push({ pathname: '/course/[id]', params: { id: featured.course.id } })}
          />
        ) : null}
      </View>

      <View style={[styles.section, featured && styles.newSection]}>
        {featured ? <Eyebrow color={colors.purple}>Learn something new</Eyebrow> : null}
        <TextInput
          accessibilityLabel="What do you want to learn?"
          placeholder="e.g. make great cocktails for a party"
          placeholderTextColor="#7E76A0"
          value={goal}
          onChangeText={setGoal}
          onSubmitEditing={() => void start(goal)}
          returnKeyType="go"
          blurOnSubmit
          multiline
          style={styles.input}
          editable={!starting}
        />
        <View style={styles.examples}>
          {EXAMPLES.map((ex) => (
            <Pressable key={ex} accessibilityRole="button" onPress={() => setGoal(ex)} style={styles.example}>
              <Text style={styles.exampleText}>{ex}</Text>
            </Pressable>
          ))}
        </View>
        <ChunkyButton label="Let’s go" variant={featured ? 'secondary' : 'primary'} onPress={() => void start(goal)} disabled={goal.trim().length < 2} loading={starting} />
        {startError ? <ErrorBox message={startError} /> : null}
      </View>

      {courses.error ? <ErrorBox message={courses.error} onRetry={courses.reload} /> : null}
      {otherCourses.length > 0 ? (
      <View style={styles.section}>
        <Eyebrow>Your other courses</Eyebrow>
        {otherCourses.map(({ course, progress, nextNodeTitle }) => (
          <Pressable
            key={course.id}
            accessibilityRole="button"
            accessibilityLabel={`${course.title}, ${progress.completed} of ${progress.required} done`}
            onPress={() => router.push({ pathname: '/course/[id]', params: { id: course.id } })}
            style={styles.courseCard}
          >
            <Companion theme={course.companion} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.courseTitle}>{course.title}</Text>
              <Text style={styles.courseMeta}>
                {course.status === 'completed' ? 'Completed' : nextNodeTitle ? `Next: ${nextNodeTitle}` : 'In progress'} · {progress.completed}/{progress.required}
              </Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${progress.required ? Math.round((progress.completed / progress.required) * 100) : 0}%` }]} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      ) : null}
      {discover.data && discover.data.courses.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>Recommended for you</Eyebrow>
          <Text style={styles.empty}>Same path, your own lessons: everything is written fresh for you as you go.</Text>
          {(showAllDiscover ? discover.data.courses : discover.data.courses.slice(0, DISCOVER_PREVIEW)).map((c) => (
            <View key={c.courseId} style={styles.courseCard}>
              <Companion theme={c.companion} size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.courseTitle}>{c.title}</Text>
                <Text style={styles.courseMeta} numberOfLines={3}>
                  {c.summary}
                </Text>
                <Text style={styles.courseMeta}>
                  {c.lessonCount} lessons · starts with {c.firstLessons.slice(0, 2).join(', ')}
                </Text>
                <ChunkyButton label="Start this course" variant="outline" onPress={() => void startDiscovered(c.courseId)} loading={startingDiscovered === c.courseId} disabled={!!startingDiscovered} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
          {discover.data.courses.length > DISCOVER_PREVIEW ? (
            <ChunkyButton
              label={showAllDiscover ? 'Show fewer' : `Show ${discover.data.courses.length - DISCOVER_PREVIEW} more`}
              variant="ghost"
              onPress={() => setShowAllDiscover((v) => !v)}
              accessibilityHint="Expands or collapses the list of courses others built"
            />
          ) : null}
        </View>
      ) : null}
      <View style={styles.resetRow}>
        {resetArmed ? (
          <>
            <Text style={styles.resetText}>Start over as a brand-new learner? Your courses stay on the server but leave this device.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ChunkyButton label="Yes, start over" variant="outline" onPress={() => void resetAsNewLearner()} style={{ flex: 1 }} />
              <ChunkyButton label="Keep" variant="ghost" onPress={() => setResetArmed(false)} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <ChunkyButton label="Start over as a new learner" variant="ghost" onPress={() => setResetArmed(true)} accessibilityHint="Forgets this device's progress so the app looks new" />
        )}
      </View>
      {__DEV__ ? <Text style={styles.foot}>{api.baseUrl}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.purple, borderRadius: 28, padding: 18, gap: 14, borderBottomWidth: 6, borderBottomColor: colors.purpleDeep },
  newSection: { padding: 16, borderRadius: 24, borderWidth: 3, borderStyle: 'dashed', borderColor: '#C4B5FD' },
  continueCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: colors.coralTint },
  continueTitle: { fontFamily: fonts.black, fontSize: 18, lineHeight: 22, color: colors.ink },
  continueMeta: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: fonts.black, fontSize: 24, color: '#FFFFFF' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.yellow },
  chipText: { fontFamily: fonts.black, fontSize: 14, color: colors.ink },
  speech: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubble: { flex: 1, backgroundColor: colors.bg, padding: 14, borderRadius: 20, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 23, color: colors.ink },
  input: { minHeight: 56, maxHeight: 120, borderWidth: 3, borderColor: '#C4B5FD', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  example: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line, flexShrink: 1, maxWidth: '100%' },
  exampleText: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.purple },
  section: { gap: 12 },
  empty: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.bg },
  courseTitle: { fontFamily: fonts.black, fontSize: 18, color: colors.ink },
  courseMeta: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', backgroundColor: colors.coral, borderRadius: 5 },
  resetRow: { gap: 10, marginTop: 12 },
  resetText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  foot: { fontFamily: fonts.bold, fontSize: 11, color: '#B8AED6', textAlign: 'center' },
});
