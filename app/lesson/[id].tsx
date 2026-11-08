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
import { recapFromObjective } from '../../src/features/lesson/recap';
import { colors, fonts } from '../../src/features/theme';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
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
    return { view, companion: course?.course.companion ?? BASE_COMPANION, courseId: view.experience.courseId, lessonTitle: node?.title ?? 'Lesson', objective: node?.objective ?? null };
  }, [id]);

  if (loaded.loading && !loaded.data) return <Shell><Loading message="Opening your lesson…" /></Shell>;
  if (loaded.error || !loaded.data) return <Shell><ErrorBox message={loaded.error ?? 'Not found'} onRetry={loaded.reload} /></Shell>;
  return (
    <Player
      initial={loaded.data.view}
      companion={loaded.data.companion}
      lessonTitle={loaded.data.lessonTitle}
      objective={loaded.data.objective}
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
  /** Filled in once the course view arrives (usually before the learner taps Finish). */
  progress?: { completed: number; required: number };
  nextTitle?: string | null;
}

/** Room between a just-answered check and the header or the feedback sheet when it is scrolled into view. */
const REVEAL_MARGIN = 12;
/** Opacities of the stacked bands that fade the last visible lines when the slide continues below. */
const FADE_STEPS = [0.85, 0.6, 0.35, 0.15];
const FADE_BAND = 6;

function Player({
  initial,
  companion,
  lessonTitle,
  objective,
  onExit,
}: {
  initial: ExperienceView;
  companion: CompanionThemeV1;
  lessonTitle: string;
  objective: string | null;
  onExit: () => void;
}) {
  const [view, setView] = useState(initial);
  const slides = view.experience.slides;
  const firstUnviewed = slides.findIndex((s) => !view.viewedSlideIds.includes(s.id));
  const [index, setIndex] = useState(view.completed ? 0 : Math.max(0, firstUnviewed));
  const [feedback, setFeedback] = useState<Record<string, ChoiceFeedback | undefined>>({});
  const [fillBlankFeedback, setFillBlankFeedback] = useState<Record<string, FillBlankFeedback | undefined>>({});
  const [matchPairsFeedback, setMatchPairsFeedback] = useState<Record<string, MatchPairsFeedback | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The server can record completion before the learner is done reading: viewing the last slide (or
   * answering the last check) completes the lesson. The completion is kept here and celebrated only
   * when the learner taps Finish, so the last slide stays on screen until then (#67).
   */
  const [completion, setCompletion] = useState<Celebration | null>(null);
  const completionRef = useRef<Celebration | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  /** One always-mounted polite region: screen readers hear feedback and completion reliably. */
  const [announce, setAnnounce] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();

  const keepCompletion = (c: Celebration | null) => {
    completionRef.current = c;
    setCompletion(c);
  };

  /** Records a completion the server just reported, and fetches what the celebration will show. */
  const recordCompletion = (c: Celebration) => {
    keepCompletion(c);
    // Course progress and the newly unlocked node; the celebration renders fine without them.
    void api
      .getCourse(view.experience.courseId)
      .then((course) => {
        const tree = course.trees.at(-1);
        if (!tree || !completionRef.current) return;
        const nextTitle = tree.tree.nodes.find((n) => n.id === tree.nextNodeId)?.title ?? null;
        keepCompletion({ ...completionRef.current, progress: tree.progress, nextTitle });
      })
      .catch(() => undefined);
  };

  const showCelebration = (c: Celebration) => {
    keepCompletion(c);
    setCelebrating(true);
    setAnnounce(c.treeCompleted ? `${lessonTitle} complete. Skill tree finished.` : `${lessonTitle} complete. The next lesson is unlocked.`);
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
        if (res.lessonCompleted) recordCompletion({ streak: res.streak, treeCompleted: res.treeCompleted });
        return res;
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);

  const finish = async () => {
    setFinishing(true);
    try {
      await pendingView.current;
      // Completed while the learner read this slide (or answered its check): celebrate now.
      if (completionRef.current) {
        showCelebration(completionRef.current);
        return;
      }
      // Otherwise ask the server: the lesson may have been completed on an earlier visit (or before a
      // reload), and then it still gets one brief celebration rather than a cold exit.
      const latest = await api.getExperience(view.experience.id).catch(() => null);
      if (latest) setView(latest);
      if (latest && !latest.completed) {
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
      if (latest?.completed) {
        const course = await api.getCourse(view.experience.courseId).catch(() => null);
        const tree = course?.trees.at(-1);
        showCelebration({
          streak: course?.streak ?? { count: 0, lastActiveDate: null },
          treeCompleted: tree?.complete ?? false,
          progress: tree?.progress,
          nextTitle: tree ? (tree.tree.nodes.find((n) => n.id === tree.nextNodeId)?.title ?? null) : null,
        });
      } else {
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

  /**
   * Keeping a just-answered check in view (#68). The feedback sheet replaces the footer and is much
   * taller, so the slide's visible area shrinks under it. Once the new layout has settled, scroll so
   * the check sits between the header and the sheet: its top just under the header when it fits
   * (no half-cut lines above it), its bottom just above the sheet when it is taller than the space
   * (the coloured answers matter more than the prompt). Nothing moves when it is already in view.
   */
  const metrics = useRef({ viewportH: 0, contentH: 0, scrollY: 0, slideTop: 0 });
  const checkBoxes = useRef<Record<string, { y: number; height: number }>>({});
  const pendingReveal = useRef<string | null>(null);
  const reveal = () => {
    const componentId = pendingReveal.current;
    pendingReveal.current = null;
    if (!componentId) return;
    const m = metrics.current;
    const box = checkBoxes.current[componentId];
    if (!box || m.viewportH <= 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    const top = m.slideTop + box.y - REVEAL_MARGIN;
    const bottom = m.slideTop + box.y + box.height + REVEAL_MARGIN;
    if (top >= m.scrollY && bottom <= m.scrollY + m.viewportH) return;
    const maxScroll = Math.max(0, m.contentH - m.viewportH);
    const target = bottom - top <= m.viewportH ? top : bottom - m.viewportH;
    scrollRef.current?.scrollTo({ y: Math.max(0, Math.min(target, maxScroll)), animated: true });
  };
  const requestReveal = (componentId: string) => {
    pendingReveal.current = componentId;
    // The footer's onLayout normally triggers it; this covers a sheet that did not change height.
    setTimeout(() => requestAnimationFrame(reveal), 250);
  };
  const updateMoreBelow = () => {
    const m = metrics.current;
    const next = m.viewportH > 0 && m.contentH - m.scrollY - m.viewportH > 24;
    setMoreBelow((prev) => (prev === next ? prev : next));
  };

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
      if (res.scored || res.scoredFillBlank || res.scoredMatchPairs) requestReveal(componentId);
      if (res.lessonCompleted) recordCompletion({ streak: res.streak, treeCompleted: res.treeCompleted });
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

  if (celebrating && completion) {
    const celebration = completion;
    const p = celebration.progress;
    const recap = recapFromObjective(objective);
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.purple }]}>
        <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
          {announce}
        </Text>
        <Confetti />
        {/* Scrolls rather than clips when large text makes the celebration taller than the screen. */}
        <ScrollView contentContainerStyle={styles.celebrateScroll}>
          <View style={styles.celebrate}>
          <Companion theme={companion} mood="cheering" size={140} />
          <Text style={styles.celebrateEyebrow}>{celebration.treeCompleted ? 'Skill tree finished' : 'Lesson complete'}</Text>
          <Text style={styles.celebrateTitle} accessibilityRole="header">
            {lessonTitle}!
          </Text>
          {recap ? <Text style={styles.celebrateRecap}>{recap}</Text> : null}
          <View style={styles.celebrateRow}>
            {p ? <ProgressGlass completed={p.completed} required={p.required} width={64} height={104} liquid={colors.yellow} countColor="#FFFFFF" /> : null}
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
          <ChunkyButton label={celebration.nextTitle && !celebration.treeCompleted ? 'Back to the path' : 'Continue'} onPress={onExit} style={{ width: '100%', maxWidth: 420, marginTop: 20, alignSelf: 'center' }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <Text accessibilityLiveRegion="polite" style={styles.srOnly}>
        {announce}
      </Text>
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
      <ScrollView
        ref={scrollRef}
        key={slide.id}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => {
          metrics.current.scrollY = e.nativeEvent.contentOffset.y;
          updateMoreBelow();
        }}
        onLayout={(e) => {
          metrics.current.viewportH = e.nativeEvent.layout.height;
          updateMoreBelow();
        }}
        onContentSizeChange={(_, h) => {
          metrics.current.contentH = h;
          updateMoreBelow();
        }}
      >
        <View style={styles.content}>
          <View style={styles.slideBox} onLayout={(e) => (metrics.current.slideTop = e.nativeEvent.layout.y)}>
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
              onAssessableLayout: (componentId, box) => (checkBoxes.current[componentId] = box),
            }}
          />
          </View>
          {error ? <ErrorBox message={error} /> : null}
        </View>
      </ScrollView>
      {/* A soft fade over the last visible lines says "there is more below" when the slide runs under the footer. */}
      {moreBelow ? (
        <View pointerEvents="none" aria-hidden style={styles.fadeWrap}>
          {FADE_STEPS.map((opacity, i) => (
            <View key={i} style={[styles.fadeStep, { bottom: i * FADE_BAND, opacity }]} />
          ))}
        </View>
      ) : null}
      <View
        style={[styles.footer, sheet && (sheet.correct ? styles.footerRight : styles.footerWrong)]}
        onLayout={() => {
          if (pendingReveal.current) requestAnimationFrame(reveal);
        }}
      >
        <View style={[styles.footerColumn, { paddingBottom: 16 + insets.bottom }]}>
          {sheet ? (
            // The correction moment: one explanation, one primary action.
            <View style={styles.sheet} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Companion theme={companion} mood={sheet.correct ? 'cheering' : 'thinking'} size={40} />
                <Text style={styles.sheetTitle}>{sheet.correct ? 'Nice! That’s it.' : 'Close! Here’s the idea'}</Text>
              </View>
              {sheet.lines.map((line, i) => (
                <Text key={i} style={styles.sheetText}>
                  {line}
                </Text>
              ))}
              {sheet.correct ? (
                <ChunkyButton label={isLast ? 'Finish' : 'Continue'} onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))} loading={finishing} />
              ) : (
                // One row, like the regular footer, so the sheet stays short enough to leave the answers in view.
                <View style={styles.sheetActions}>
                  <ChunkyButton
                    label={isLast ? 'Skip and finish' : 'Skip for now'}
                    variant="ghost"
                    onPress={() => (isLast ? void finish() : setIndex((i) => i + 1))}
                    loading={isLast && finishing}
                    style={styles.sheetSkip}
                  />
                  <ChunkyButton label="Try again" onPress={() => tryAgain(sheet.componentId)} accessibilityHint="Pick a different answer. No penalty." style={styles.sheetRetry} />
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
                <Text style={styles.footerHint} accessibilityLiveRegion="polite">
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
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
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
  sheet: { gap: 8 },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  sheetSkip: { flexGrow: 0, minWidth: 120 },
  sheetRetry: { flexGrow: 1, flexBasis: 180 },
  slideBox: { flexGrow: 1 },
  // Zero-height anchor between the scroll view and the footer; the bands hang upwards over the slide.
  fadeWrap: { height: 0, zIndex: 1 },
  fadeStep: { position: 'absolute', left: 0, right: 0, height: FADE_BAND, backgroundColor: colors.bg },
  sheetTitle: { flex: 1, fontFamily: fonts.black, fontSize: 18, color: colors.ink },
  sheetText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  celebrateScroll: { flexGrow: 1 },
  celebrate: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  celebrateEyebrow: { fontFamily: fonts.black, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.purpleTint },
  celebrateTitle: { fontFamily: fonts.black, fontSize: 36, lineHeight: 42, color: '#FFFFFF', textAlign: 'center' },
  celebrateRecap: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 24, color: '#FFFFFF', textAlign: 'center', maxWidth: 440 },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8, width: '100%', maxWidth: 420 },
  celebrateText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 23, color: '#EDE9FE' },
  streakPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  streakPillText: { fontFamily: fonts.black, fontSize: 15, color: colors.ink },
});
