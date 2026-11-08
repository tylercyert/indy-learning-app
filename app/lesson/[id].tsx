import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_COMPANION, componentRole, type CompanionThemeV1, type ExperienceView, type StreakV1 } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import type { FillBlankFeedback } from '../../src/features/components/FillBlank';
import type { MatchPairsFeedback } from '../../src/features/components/MatchPairs';
import type { ChoiceFeedback } from '../../src/features/components/MultipleChoice';
import { SlideView } from '../../src/features/components/SlideView';
import { colors, fonts } from '../../src/features/theme';
import { announce } from '../../src/features/ui/announce';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
import { focusWhenShown } from '../../src/features/ui/focus';
import { Confetti } from '../../src/features/ui/Confetti';
import { ProgressGlass } from '../../src/features/ui/ProgressGlass';
import * as Haptics from 'expo-haptics';
import { AppBar, CONTENT_MAX_WIDTH, ErrorBox, Loading } from '../../src/features/ui/Screen';
import { useAsync } from '../../src/features/ui/useAsync';
import { api, localDate } from '../../src/services/api';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const loaded = useAsync(async () => {
    const view = await api.getExperience(id);
    // The companion and the lesson's title belong to the course; fetch it once.
    const course = await api.getCourse(view.experience.courseId).catch(() => null);
    const node = course?.trees.flatMap((t) => t.tree.nodes).find((n) => n.lessonId === view.experience.lessonId);
    return { view, companion: course?.course.companion ?? BASE_COMPANION, courseId: view.experience.courseId, lessonTitle: node?.title ?? 'Lesson' };
  }, [id]);

  if (loaded.loading && !loaded.data) return <Shell><Loading message="Opening your lesson…" /></Shell>;
  if (loaded.error || !loaded.data) return <Shell><ErrorBox message={loaded.error ?? 'Not found'} onRetry={loaded.reload} /></Shell>;
  return (
    <Player
      initial={loaded.data.view}
      companion={loaded.data.companion}
      lessonTitle={loaded.data.lessonTitle}
      onExit={() => router.replace({ pathname: '/course/[id]', params: { id: loaded.data!.courseId } })}
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <AppBar back={{ label: 'Close lesson' }} />
      {children}
    </SafeAreaView>
  );
}

interface Celebration {
  streak: StreakV1;
  treeCompleted: boolean;
  /** Filled in once the course view arrives: the glass fills from before to after. */
  progress?: { completed: number; required: number };
  nextTitle?: string | null;
}

function Player({ initial, companion, lessonTitle, onExit }: { initial: ExperienceView; companion: CompanionThemeV1; lessonTitle: string; onExit: () => void }) {
  const [view, setView] = useState(initial);
  const slides = view.experience.slides;
  const firstUnviewed = slides.findIndex((s) => !view.viewedSlideIds.includes(s.id));
  const [index, setIndex] = useState(view.completed ? 0 : Math.max(0, firstUnviewed));
  const [feedback, setFeedback] = useState<Record<string, ChoiceFeedback | undefined>>({});
  const [fillBlankFeedback, setFillBlankFeedback] = useState<Record<string, FillBlankFeedback | undefined>>({});
  const [matchPairsFeedback, setMatchPairsFeedback] = useState<Record<string, MatchPairsFeedback | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [finishing, setFinishing] = useState(false);
  /** The app's one persistent polite region (AnnouncerHost in the root layout; VoiceOver on iOS). */
  const setAnnounce = announce;
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();

  const celebrate = (c: Celebration) => {
    setCelebration(c);
    setAnnounce(c.treeCompleted ? `${lessonTitle} complete. Skill tree finished.` : `${lessonTitle} complete. The next lesson is unlocked.`);
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    // Enrich with course progress and the newly unlocked node; the screen renders fine without it.
    void api
      .getCourse(view.experience.courseId)
      .then((course) => {
        const tree = course.trees.at(-1);
        if (!tree) return;
        const nextTitle = tree.tree.nodes.find((n) => n.id === tree.nextNodeId)?.title ?? null;
        setCelebration((prev) => (prev ? { ...prev, progress: tree.progress, nextTitle } : prev));
      })
      .catch(() => undefined);
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
      if (!celebration && latest && !latest.completed) {
        // A check was skipped earlier: go back to it instead of exiting cold.
        const answered = new Set(latest.results.map((r) => r.componentId));
        const missing = slides.findIndex((s) => s.components.some((c) => componentRole(c.type) === 'assessable' && !answered.has(c.id)));
        if (missing >= 0) {
          setIndex(missing);
          setError('One quick check is still open. Answer it (or skip it after reading the idea) to finish the lesson.');
          setAnnounce('One check is still open on this slide.');
          return;
        }
      }
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
  /** The explanation sheet for this slide's check, if the learner just answered it. */
  const sheet = (() => {
    for (const cid of assessablesOnSlide) {
      const mc = feedback[cid];
      if (mc) return { componentId: cid, correct: mc.correct, lines: [mc.explanation] };
      const fb = fillBlankFeedback[cid];
      if (fb) return { componentId: cid, correct: fb.correct, lines: fb.gaps.filter((g) => !g.correct && g.explanation).map((g) => g.explanation) };
      const mp = matchPairsFeedback[cid];
      if (mp) return { componentId: cid, correct: mp.correct, lines: mp.matches.filter((m) => !m.correct && m.explanation).map((m) => m.explanation) };
    }
    return null;
  })();

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
      if (res.scoredFillBlank) {
        const fb = res.scoredFillBlank;
        setFillBlankFeedback((f) => ({ ...f, [componentId]: fb }));
        const wrong = fb.gaps.filter((g) => !g.correct).map((g) => g.explanation).join(' ');
        setAnnounce(fb.correct ? 'Correct.' : `Not quite. ${wrong}`);
      }
      if (res.scoredMatchPairs) {
        const mp = res.scoredMatchPairs;
        setMatchPairsFeedback((f) => ({ ...f, [componentId]: mp }));
        const wrong = mp.matches.filter((m) => !m.correct).map((m) => m.explanation).join(' ');
        setAnnounce(mp.correct ? 'Correct.' : `Not quite. ${wrong}`);
      }
      if (res.scored || res.scoredFillBlank || res.scoredMatchPairs) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      if (res.lessonCompleted) celebrate({ streak: res.streak, treeCompleted: res.treeCompleted });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setBusy(null);
    }
  };

  /** Clears the explanation so the learner can pick again; the component shows its Check button again. */
  const tryAgain = (componentId: string) => {
    setFeedback((f) => ({ ...f, [componentId]: undefined }));
    setFillBlankFeedback((f) => ({ ...f, [componentId]: undefined }));
    setMatchPairsFeedback((f) => ({ ...f, [componentId]: undefined }));
  };

  if (celebration && isLast && !finishing) {
    const p = celebration.progress;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.purple }]}>
        <Confetti />
        <View style={styles.celebrate}>
          <Companion theme={companion} mood="cheering" size={140} />
          <Text style={styles.celebrateEyebrow}>{celebration.treeCompleted ? 'Skill tree finished' : 'Lesson complete'}</Text>
          <Text ref={focusWhenShown} style={styles.celebrateTitle} accessibilityRole="header">
            {lessonTitle}!
          </Text>
          <View style={styles.celebrateRow}>
            {p ? <ProgressGlass completed={p.completed} required={p.required} width={64} height={104} liquid={colors.yellow} /> : null}
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={styles.celebrateText}>
                {celebration.treeCompleted
                  ? 'Every required lesson in this tree is done. Optional branches stay open whenever you want them.'
                  : celebration.nextTitle
                    ? `Next up: ${celebration.nextTitle}. It’s unlocked and waiting.`
                    : 'The next lesson on your path just unlocked.'}
              </Text>
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>🔥 {celebration.streak.count}-day streak</Text>
              </View>
            </View>
          </View>
          <ChunkyButton label={celebration.nextTitle && !celebration.treeCompleted ? 'Back to the path' : 'Continue'} onPress={onExit} style={{ width: '100%', maxWidth: 420, marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* Same purple bar as every other screen; the progress track takes the wordmark's place. */}
      <AppBar back={{ label: 'Close lesson', onPress: onExit }} right={<Text style={styles.count} aria-hidden>{index + 1}/{slides.length}</Text>}>
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
      </AppBar>
      {/* Keyed per slide so each slide opens scrolled to the top. */}
      <ScrollView ref={scrollRef} key={slide.id} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
              fillBlankFeedback,
              onFillBlank: (componentId, answers) => void send(componentId, { type: 'fillBlank', slideId: slide.id, componentId, answers }),
              matchPairsFeedback,
              onMatchPairs: (componentId, matches) => void send(componentId, { type: 'matchPairs', slideId: slide.id, componentId, matches }),
              feedbackInFooter: true,
            }}
          />
          {error ? <ErrorBox message={error} /> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, sheet && (sheet.correct ? styles.footerRight : styles.footerWrong)]}>
        <View style={[styles.footerColumn, { paddingBottom: 16 + insets.bottom }]}>
          {sheet ? (
            // The correction moment: one explanation, one primary action.
            // Focus moves to its title when it appears; the explanation itself is announced by send().
            <View style={styles.sheet}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Companion theme={companion} mood={sheet.correct ? 'cheering' : 'thinking'} size={44} decorative />
                <Text ref={focusWhenShown} style={styles.sheetTitle}>{sheet.correct ? 'Nice! That’s it.' : 'Close! Here’s the idea'}</Text>
              </View>
              {sheet.lines.map((line, i) => (
                <Text key={i} style={styles.sheetText}>
                  {line}
                </Text>
              ))}
              {sheet.correct ? (
                <ChunkyButton label={isLast ? 'Finish' : 'Continue'} onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))} loading={finishing} />
              ) : (
                <View style={{ gap: 6 }}>
                  <ChunkyButton label="Try again" onPress={() => tryAgain(sheet.componentId)} accessibilityHint="Pick a different answer. No penalty." />
                  <ChunkyButton label={isLast ? 'Skip for now and finish' : 'Skip for now'} variant="ghost" onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.footerRow}>
              {index > 0 ? <ChunkyButton label="Previous" variant="ghost" onPress={() => setIndex((i) => i - 1)} style={{ minWidth: 100 }} /> : <View style={{ width: 100 }} />}
              {answeredOnSlide ? (
                <ChunkyButton
                  label={isLast ? 'Finish' : 'Continue'}
                  onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))}
                  loading={finishing}
                  style={{ flex: 1 }}
                />
              ) : (
                // One call to action at a time: the Check button inside the slide is the primary until answered.
                <Text style={styles.footerHint}>
                  Answer the question to continue
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  progress: { flex: 1, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.yellow, borderRadius: 8 },
  count: { fontFamily: fonts.black, fontSize: 13, color: '#FFFFFF', minWidth: 44, textAlign: 'right' },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  footerRight: { backgroundColor: colors.greenTint, borderTopColor: colors.green },
  footerWrong: { backgroundColor: colors.coralTint, borderTopColor: '#FFD1B8' },
  footerColumn: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: 16 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerHint: { flex: 1, textAlign: 'center', fontFamily: fonts.extraBold, fontSize: 14, color: colors.muted },
  sheet: { gap: 10 },
  sheetTitle: { flex: 1, fontFamily: fonts.black, fontSize: 18, color: colors.ink },
  sheetText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  celebrate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  celebrateEyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.purpleTint },
  celebrateTitle: { fontFamily: fonts.black, fontSize: 36, lineHeight: 42, color: '#FFFFFF', textAlign: 'center' },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8, width: '100%', maxWidth: 420 },
  celebrateText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 23, color: '#EDE9FE' },
  streakPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  streakPillText: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
});
