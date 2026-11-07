import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_COMPANION, componentRole, type CompanionThemeV1, type ExperienceView, type StreakV1 } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import type { ChoiceFeedback } from '../../src/features/components/MultipleChoice';
import { SlideView } from '../../src/features/components/SlideView';
import { colors, fonts } from '../../src/features/theme';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
import { Confetti } from '../../src/features/ui/Confetti';
import * as Haptics from 'expo-haptics';
import { BackButton, CONTENT_MAX_WIDTH, ErrorBox, Loading } from '../../src/features/ui/Screen';
import { useAsync } from '../../src/features/ui/useAsync';
import { api, localDate } from '../../src/services/api';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const loaded = useAsync(async () => {
    const view = await api.getExperience(id);
    // The companion belongs to the course; fetch it once for callouts.
    const course = await api.getCourse(view.experience.courseId).catch(() => null);
    return { view, companion: course?.course.companion ?? BASE_COMPANION, courseId: view.experience.courseId };
  }, [id]);

  if (loaded.loading && !loaded.data) return <Shell><Loading message="Opening your lesson…" /></Shell>;
  if (loaded.error || !loaded.data) return <Shell><ErrorBox message={loaded.error ?? 'Not found'} onRetry={loaded.reload} /></Shell>;
  return <Player initial={loaded.data.view} companion={loaded.data.companion} courseId={loaded.data.courseId} onExit={() => router.replace({ pathname: '/course/[id]', params: { id: loaded.data!.courseId } })} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <BackButton label="Close lesson" />
      </View>
      {children}
    </SafeAreaView>
  );
}

function Player({ initial, companion, onExit }: { initial: ExperienceView; companion: CompanionThemeV1; courseId: string; onExit: () => void }) {
  const [view, setView] = useState(initial);
  const slides = view.experience.slides;
  const firstUnviewed = slides.findIndex((s) => !view.viewedSlideIds.includes(s.id));
  const [index, setIndex] = useState(view.completed ? 0 : Math.max(0, firstUnviewed));
  const [feedback, setFeedback] = useState<Record<string, ChoiceFeedback | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ streak: StreakV1; treeCompleted: boolean } | null>(null);
  const [finishing, setFinishing] = useState(false);
  /** One always-mounted polite region: screen readers hear feedback and completion reliably. */
  const [announce, setAnnounce] = useState('');

  const celebrate = (c: { streak: StreakV1; treeCompleted: boolean }) => {
    setCelebration(c);
    setAnnounce(c.treeCompleted ? 'Lesson complete. Skill tree finished.' : 'Lesson complete. The next lesson is unlocked.');
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  const viewedThisSession = useRef(new Set<string>());
  /** The most recent slideViewed request, so Finish can wait for the completion it may trigger. */
  const pendingView = useRef<Promise<unknown>>(Promise.resolve());

  const slide = slides[index]!;
  const isLast = index === slides.length - 1;

  // Record the view once per slide per session; the server is idempotent anyway.
  useEffect(() => {
    if (viewedThisSession.current.has(slide.id)) return;
    viewedThisSession.current.add(slide.id);
    pendingView.current = api
      .sendEvent(view.experience.id, { type: 'slideViewed', slideId: slide.id, localDate: localDate() })
      .then((res) => {
        setView(res.view);
        if (res.lessonCompleted) celebrate({ streak: res.streak, treeCompleted: res.treeCompleted });
        return res;
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);

  const finish = async () => {
    setFinishing(true);
    try {
      await pendingView.current;
      // If the lesson was completed on an earlier visit, still celebrate briefly rather than exit cold.
      const latest = await api.getExperience(view.experience.id).catch(() => null);
      if (latest) setView(latest);
      if (!celebration && latest?.completed) {
        const course = await api.getCourse(view.experience.courseId).catch(() => null);
        celebrate({ streak: course?.streak ?? { count: 0, lastActiveDate: null }, treeCompleted: course?.trees.at(-1)?.complete ?? false });
      } else if (!celebration) {
        onExit();
      }
    } finally {
      setFinishing(false);
    }
  };

  const assessablesOnSlide = useMemo(() => slide.components.filter((c) => componentRole(c.type) === 'assessable').map((c) => c.id), [slide]);
  const answeredOnSlide = assessablesOnSlide.every((cid) => view.results.some((r) => r.componentId === cid));

  const send = async (componentId: string, event: Parameters<typeof api.sendEvent>[1]) => {
    setBusy(componentId);
    setError(null);
    try {
      const res = await api.sendEvent(view.experience.id, { ...event, localDate: localDate() });
      setView(res.view);
      if (res.scored) {
        setFeedback((f) => ({ ...f, [componentId]: res.scored! }));
        setAnnounce(`${res.scored.correct ? 'Correct.' : 'Not quite.'} ${res.scored.explanation}`);
      }
      if (res.lessonCompleted) celebrate({ streak: res.streak, treeCompleted: res.treeCompleted });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setBusy(null);
    }
  };

  if (celebration && isLast && !finishing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.purple }]}>
        <Confetti />
        <View style={styles.celebrate}>
          <Companion theme={companion} mood="cheering" size={150} />
          <Text style={styles.celebrateEyebrow}>Lesson complete</Text>
          <Text style={styles.celebrateTitle}>{celebration.treeCompleted ? 'Skill tree finished!' : 'Nice work!'}</Text>
          <Text style={styles.celebrateText}>
            {celebration.treeCompleted ? 'Every required lesson in this tree is done. Optional branches stay open whenever you want them.' : 'The next lesson on your path just unlocked.'}
          </Text>
          <View style={styles.streakPill}>
            <Text style={styles.streakPillText}>🔥 {celebration.streak.count}-day streak</Text>
          </View>
          <ChunkyButton label="Continue" onPress={onExit} style={{ width: '100%', maxWidth: 420, marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {announce}
      </Text>
      <View style={styles.header}>
        <View style={styles.headerColumn}>
          <BackButton label="Close lesson" onPress={onExit} />
          <View
            style={styles.progress}
            accessibilityRole="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={slides.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Slide ${index + 1} of ${slides.length}`}
          >
            <View style={[styles.progressFill, { width: `${((index + 1) / slides.length) * 100}%` }]} />
          </View>
          <Text style={styles.count} aria-hidden>
            {index + 1}/{slides.length}
          </Text>
        </View>
      </View>
      {/* Keyed per slide so each slide opens scrolled to the top. */}
      <ScrollView key={slide.id} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
        <SlideView
          slide={slide}
          companion={companion}
          interactions={{
            results: view.results,
            feedback,
            busyComponentId: busy,
            onAnswer: (componentId, optionId) => void send(componentId, { type: 'answer', slideId: slide.id, componentId, selectedOptionId: optionId }),
            onChecklist: (componentId, checkedItemIds, confirmed) => void send(componentId, { type: 'checklist', slideId: slide.id, componentId, checkedItemIds, confirmed }),
          }}
        />
        {error ? <ErrorBox message={error} /> : null}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerColumn}>
          {index > 0 ? <ChunkyButton label="Back" variant="ghost" onPress={() => setIndex((i) => i - 1)} style={{ width: 90 }} /> : <View style={{ width: 90 }} />}
          {answeredOnSlide ? (
            <ChunkyButton
              label={isLast ? 'Finish' : 'Continue'}
              onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))}
              loading={finishing}
              style={{ flex: 1 }}
            />
          ) : (
            // One call to action at a time: the Check button inside the slide is the primary until answered.
            <Text style={styles.footerHint} accessibilityLiveRegion="polite">
              Answer the question to continue
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerColumn: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 },
  progress: { flex: 1, height: 16, borderRadius: 8, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.yellow, borderRadius: 8 },
  count: { fontFamily: fonts.black, fontSize: 13, color: colors.muted, minWidth: 44, textAlign: 'right' },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  footerColumn: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  footerHint: { flex: 1, textAlign: 'center', fontFamily: fonts.extraBold, fontSize: 14, color: colors.muted },
  celebrate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  celebrateEyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.purpleTint },
  celebrateTitle: { fontFamily: fonts.black, fontSize: 36, color: '#FFFFFF', textAlign: 'center' },
  celebrateText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 23, color: '#EDE9FE', textAlign: 'center', maxWidth: 320 },
  streakPill: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF' },
  streakPillText: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
});
