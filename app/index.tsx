import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BASE_COMPANION } from '../src/contracts';
import { Companion } from '../src/features/companion/Companion';
import { colors, fonts } from '../src/features/theme';
import { ChunkyButton } from '../src/features/ui/ChunkyButton';
import { ErrorBox, Eyebrow, Screen } from '../src/features/ui/Screen';
import { useAsync } from '../src/features/ui/useAsync';
import { api } from '../src/services/api';

const EXAMPLES = ['Make great cocktails for a party', 'Learn Indonesian basics', 'Understand how engines work', 'Python for data analysis'];

export default function HomeScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const courses = useAsync(() => api.listCourses(), []);
  const discover = useAsync(() => api.discover(), []);
  const [startingDiscovered, setStartingDiscovered] = useState<string | null>(null);

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

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.brand}>Indy</Text>
          {streak > 0 ? (
            <View style={styles.chip} accessibilityLabel={`${streak} day streak`}>
              <Text style={styles.chipText}>🔥 {streak}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.speech}>
          <Companion theme={BASE_COMPANION} mood="curious" size={88} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Hi, I’m Pip! What do you want to learn?</Text>
          </View>
        </View>
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
        <ChunkyButton label="Let’s go" onPress={() => void start(goal)} disabled={goal.trim().length < 2} loading={starting} />
        {startError ? <ErrorBox message={startError} /> : null}
      </View>

      <View style={styles.section}>
        <Eyebrow>Your courses</Eyebrow>
        {courses.error ? <ErrorBox message={courses.error} onRetry={courses.reload} /> : null}
        {courses.data && courses.data.courses.length === 0 ? (
          <Text style={styles.empty}>Nothing yet. Tell Pip what you’re up to and a course appears here.</Text>
        ) : null}
        {courses.data?.courses.map(({ course, progress, nextNodeTitle }) => (
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
      {discover.data && discover.data.courses.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>Discover courses others built</Eyebrow>
          <Text style={styles.empty}>Same path, your own lessons: everything is written fresh for you as you go.</Text>
          {discover.data.courses.map((c) => (
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
        </View>
      ) : null}
      {__DEV__ ? <Text style={styles.foot}>{api.baseUrl}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.soft, borderRadius: 28, padding: 18, gap: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: fonts.black, fontSize: 24, color: colors.purple },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.bg },
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
  foot: { fontFamily: fonts.bold, fontSize: 11, color: '#B8AED6', textAlign: 'center' },
});
