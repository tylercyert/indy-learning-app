import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BASE_COMPANION, type IntakeSessionView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
import { BeakerLoader } from '../../src/features/ui/BeakerLoader';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
import { AppBar, ErrorBox, Screen } from '../../src/features/ui/Screen';
import { StatusTicker } from '../../src/features/ui/StatusTicker';
import { PLANNING_LINES } from '../../src/features/ui/status-ticker';
import { useAsync } from '../../src/features/ui/useAsync';
import { api } from '../../src/services/api';

const MAX_QUESTIONS = 4;

export default function IntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAsync(() => api.getIntake(id), [id]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the learner leaves the planning screen: the build carries on, but must not navigate them. */
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);

  const view: IntakeSessionView | null = session.data;
  const lastCompanion = view?.transcript.filter((m) => m.role === 'companion').at(-1);
  const turn = view?.turn;
  const settled = view?.status === 'ready' || view?.status === 'planned';
  const horizonLabel = { quickWin: 'A quick win, soon', steady: 'Over a few weeks', deep: 'Going deep' } as const;
  const levelLabel = { new: 'Brand new to this', some: 'Some experience', experienced: 'Experienced' } as const;
  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const correction = draft.trim();

  const send = async (text: string) => {
    const answer = text.trim();
    if (!answer || !view) return;
    setSending(true);
    setError(null);
    try {
      const next = await api.replyIntake(view.id, answer);
      session.setData(next);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that');
    } finally {
      setSending(false);
    }
  };

  const build = async () => {
    if (!view) return;
    setPlanning(true);
    setError(null);
    try {
      // An intake started inside a course becomes a new skill tree there; otherwise a new course.
      const course = view.courseId ? await api.addTree(view.courseId, { kind: 'explore', intakeId: view.id }) : await api.createCourse(view.id);
      if (left.current) return;
      router.replace({ pathname: '/course/[id]', params: { id: course.course.id } });
    } catch (e) {
      if (left.current) return;
      setError(e instanceof Error ? e.message : 'Could not plan the course');
      setPlanning(false);
    }
  };

  /**
   * Leaving the planning screen (#20). Planning runs on the server and finishes either way (there is
   * no server-side cancel), so the screen says so, and Home (or the course) watches for the result.
   */
  const leavePlanning = () => {
    left.current = true;
    if (view?.courseId) router.replace({ pathname: '/course/[id]', params: { id: view.courseId, building: '1' } });
    else router.replace({ pathname: '/', params: { building: '1' } });
  };

  if (planning) {
    const addingTree = Boolean(view?.courseId);
    return (
      <Screen scroll={false} header={<AppBar back={{ label: addingTree ? 'Back to course' : 'Back to home', onPress: leavePlanning }} />}>
        <View style={styles.planning}>
          <BeakerLoader size={210} />
          <Text style={styles.planningTitle}>{addingTree ? 'Adding a new skill tree…' : 'Mixing up your course…'}</Text>
          {/* Four to six short lines over the ~60 s wait, so the screen never looks stuck. */}
          <StatusTicker lines={addingTree ? PLANNING_LINES.tree : PLANNING_LINES.course} intervalMs={7000} />
          <Text style={styles.planningText}>
            {addingTree ? 'Poko is planning the new branch and writing its first lesson.' : 'Your first lesson will be ready the moment the path is. About a minute.'}
          </Text>
          <Text style={styles.planningNote}>
            {addingTree ? 'You can go back to your course: the new tree appears there when it’s ready.' : 'You can leave this screen: your course keeps building and appears on Home.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollToEndKey={`${view?.transcript.length ?? 0}-${sending}-${view?.status ?? ''}`}
      header={
        <AppBar
          back={{
            label: view?.courseId ? 'Back to course' : 'Back to home',
            onPress: () => (view?.courseId ? router.replace({ pathname: '/course/[id]', params: { id: view.courseId } }) : router.replace('/')),
          }}
          right={<IntakePips asked={view?.questionsAsked ?? 0} settled={settled} />}
        />
      }
      footer={
        view && turn?.kind === 'ask' ? (
          <View style={styles.row}>
            <TextInput
              accessibilityLabel="Your answer"
              placeholder="Type your answer"
              placeholderTextColor="#7E76A0"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void send(draft)}
              returnKeyType="send"
              editable={!sending}
              style={styles.input}
            />
            <ChunkyButton label="Send" onPress={() => void send(draft)} disabled={!draft.trim()} loading={sending} style={{ alignSelf: 'auto', width: 110 }} />
          </View>
        ) : view && view.status === 'ready' ? (
          <View style={{ gap: 10 }}>
            {/* One dominant action. The correction field sits beneath it, quiet until the learner types. */}
            <ChunkyButton
              label={view.courseId ? 'Add to my course' : 'Build my course'}
              onPress={() => void build()}
              disabled={correction.length > 0}
              accessibilityHint={correction.length > 0 ? 'Send or clear your correction first' : undefined}
            />
            <View style={styles.row}>
              <TextInput
                accessibilityLabel="Correct something before building"
                placeholder="Not quite right? Fix it here (optional)"
                placeholderTextColor="#8E86A8"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void send(draft)}
                returnKeyType="send"
                editable={!sending}
                style={[styles.input, styles.correctionInput]}
              />
              {correction.length > 0 ? (
                <ChunkyButton label="Send" variant="outline" onPress={() => void send(draft)} loading={sending} style={{ alignSelf: 'auto', width: 110 }} />
              ) : null}
            </View>
          </View>
        ) : null
      }
    >
      {session.loading && !view ? (
        // Warm first paint: the companion is already here and thinking, not a spinner.
        <View style={styles.companionRow} accessibilityLiveRegion="polite">
          <Companion theme={BASE_COMPANION} mood="thinking" size={56} />
          <View style={styles.companionBubble}>
            <Text style={styles.companionText}>Ooh, good one. Give me a second to think about where to start…</Text>
          </View>
        </View>
      ) : null}
      {session.error ? <ErrorBox message={session.error} onRetry={session.reload} /> : null}

      {view?.transcript.map((m, i) => {
        const isLast = m === lastCompanion;
        return m.role === 'learner' ? (
          <View key={i} style={styles.learnerRow}>
            <View style={styles.learnerBubble}>
              <Text style={styles.learnerText}>{m.text}</Text>
            </View>
          </View>
        ) : (
          <View key={i} style={styles.companionRow}>
            <Companion theme={BASE_COMPANION} mood={isLast && view.status === 'ready' ? 'cheering' : 'curious'} size={56} />
            <View style={styles.companionBubble}>
              <Text style={styles.companionText}>{m.text}</Text>
            </View>
          </View>
        );
      })}

      {/* Quick answers sit right under the question (not pinned to the footer), so the eye never travels. */}
      {view && turn?.kind === 'ask' && !sending ? (
        <View style={[styles.chips, { paddingLeft: 66 }]}>
          {turn.suggestedAnswers.map((a) => (
            <Pressable
              key={a}
              testID="intake-chip"
              accessibilityRole="button"
              onPress={() => void send(a)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{a}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {sending ? (
        <View style={styles.companionRow}>
          <Companion theme={BASE_COMPANION} mood="thinking" size={56} />
          <View style={styles.companionBubble}>
            <Text style={styles.companionText}>…</Text>
          </View>
        </View>
      ) : null}

      {view?.status === 'ready' && view.context ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>What Poko understood</Text>
          <SummaryRow label="Topic" value={titleCase(view.context.goal.topic)} />
          <SummaryRow label="You want to" value={view.context.goal.outcome} />
          {view.context.goal.application ? <SummaryRow label="Where" value={view.context.goal.application} /> : null}
          <SummaryRow label="Starting point" value={levelLabel[view.context.experience.level]} />
          <SummaryRow label="Pace" value={horizonLabel[view.context.horizon]} />
          {view.context.facts.length ? <SummaryList label="You told me" items={view.context.facts} /> : null}
          {view.context.constraints.length ? <SummaryList label="Keeping in mind" items={view.context.constraints} /> : null}
          <Text style={styles.summaryNote}>Not right? Fix it in the box below before building.</Text>
        </View>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
    </Screen>
  );
}

/**
 * Intake progress as a filling object: one pip per possible question, purple as they are asked,
 * all mint once Poko has enough. The fraction is the accessible value; the pips are decorative.
 */
function IntakePips({ asked, settled }: { asked: number; settled: boolean }) {
  const filled = settled ? MAX_QUESTIONS : Math.min(asked, MAX_QUESTIONS);
  const text = settled ? 'Ready to build' : asked === 0 ? 'Getting started' : `Question ${filled} of up to ${MAX_QUESTIONS}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Intake progress"
      accessibilityValue={{ min: 0, max: MAX_QUESTIONS, now: filled, text }}
      style={styles.pips}
    >
      {Array.from({ length: MAX_QUESTIONS }, (_, i) => (
        <View key={i} style={[styles.pip, i < filled && (settled ? styles.pipDone : styles.pipFilled)]} />
      ))}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SummaryList({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        {items.map((item) => (
          <Text key={item} style={styles.summaryValue}>
            • {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The pips sit in the purple app bar: translucent white track, yellow as asked, mint when settled.
  pips: { flexDirection: 'row', gap: 6, width: 120 },
  pip: { flex: 1, height: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' },
  pipFilled: { backgroundColor: colors.yellow },
  pipDone: { backgroundColor: colors.mint },
  learnerRow: { alignItems: 'flex-end' },
  learnerBubble: { maxWidth: '85%', backgroundColor: colors.purple, padding: 14, borderRadius: 20, borderBottomRightRadius: 6 },
  learnerText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  companionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  companionBubble: { flex: 1, backgroundColor: colors.soft, padding: 14, borderRadius: 20, borderBottomLeftRadius: 6 },
  companionText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // maxWidth + flexShrink: a long quick answer wraps inside its pill instead of running off the screen (#20).
  chip: { minHeight: 44, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 3, borderColor: '#C4B5FD', backgroundColor: colors.bg },
  chipPressed: { backgroundColor: colors.purpleTint, borderColor: colors.purple },
  chipText: { flexShrink: 1, fontFamily: fonts.black, fontSize: 14, lineHeight: 18, color: colors.purple },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  // minWidth 0: a web <input> has an intrinsic width (its size attribute) and would not shrink below it,
  // which pushed the row 4 px past a 390 px screen and clipped the Send button (#68).
  input: { flex: 1, minWidth: 0, minHeight: 56, borderWidth: 3, borderColor: '#C4B5FD', borderRadius: 18, paddingHorizontal: 16, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
  // Secondary by design: thinner, quieter, and it never competes with the Build button above it.
  correctionInput: { minHeight: 48, borderWidth: 2, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.soft, fontFamily: fonts.bold, fontSize: 15 },
  summary: { padding: 16, borderRadius: 22, backgroundColor: colors.mintTint, gap: 8 },
  summaryTitle: { fontFamily: fonts.black, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mintDeep },
  summaryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  summaryLabel: { width: 112, fontFamily: fonts.black, fontSize: 13, color: colors.mintDeep, paddingTop: 1 },
  summaryValue: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  summaryNote: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted, marginTop: 4 },
  planning: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  planningTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.ink, textAlign: 'center' },
  planningText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  planningNote: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', maxWidth: 320 },
});
