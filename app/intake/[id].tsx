import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BASE_COMPANION, type IntakeSessionView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
import { BeakerLoader } from '../../src/features/ui/BeakerLoader';
import { ChunkyButton } from '../../src/features/ui/ChunkyButton';
import { BackButton, ErrorBox, Loading, Screen } from '../../src/features/ui/Screen';
import { useAsync } from '../../src/features/ui/useAsync';
import { api } from '../../src/services/api';

export default function IntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAsync(() => api.getIntake(id), [id]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view: IntakeSessionView | null = session.data;
  const lastCompanion = view?.transcript.filter((m) => m.role === 'companion').at(-1);
  const turn = view?.turn;
  const headerText = !view
    ? ''
    : view.status === 'ready'
      ? 'Ready to build'
      : view.status === 'planned'
        ? 'Course built'
        : `Question ${Math.min(view.questionsAsked, 4)} of up to 4`;
  const horizonLabel = { quickWin: 'A quick win, soon', steady: 'Over a few weeks', deep: 'Going deep' } as const;
  const levelLabel = { new: 'Brand new to this', some: 'Some experience', experienced: 'Experienced' } as const;
  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
      router.replace({ pathname: '/course/[id]', params: { id: course.course.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the course');
      setPlanning(false);
    }
  };

  if (planning) {
    return (
      <Screen scroll={false}>
        <View style={styles.planning}>
          <BeakerLoader size={210} />
          <Text style={styles.planningTitle}>{view?.courseId ? 'Adding a new skill tree…' : 'Mixing up your course…'}</Text>
          <Text style={styles.planningText}>
            {view?.courseId
              ? 'Pip is planning the new branch and writing its first lesson. About a minute.'
              : 'Pip is laying out the path, picking a companion, and writing your first lesson so you can start right away. About a minute.'}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollToEndKey={`${view?.transcript.length ?? 0}-${sending}-${view?.status ?? ''}`}
      footer={
        view && turn?.kind === 'ask' ? (
          <View style={{ gap: 10 }}>
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
          </View>
        ) : view && view.status === 'ready' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.row}>
              <TextInput
                accessibilityLabel="Correct something before building"
                placeholder="Anything to correct? (optional)"
                placeholderTextColor="#7E76A0"
                value={draft}
                onChangeText={setDraft}
                editable={!sending}
                style={styles.input}
              />
            </View>
            <ChunkyButton label={view.courseId ? 'Add to my course' : 'Build my course'} onPress={() => void build()} disabled={draft.trim().length > 0} />
            {draft.trim().length > 0 ? <ChunkyButton label="Send correction" variant="outline" onPress={() => void send(draft)} loading={sending} /> : null}
          </View>
        ) : null
      }
    >
      <View style={styles.header}>
        <BackButton label={view?.courseId ? 'Back to course' : 'Back to home'} onPress={() => (view?.courseId ? router.replace({ pathname: '/course/[id]', params: { id: view.courseId } }) : router.replace('/'))} />
        <Text style={styles.headerText}>{headerText}</Text>
      </View>

      {session.loading && !view ? <Loading message="Pip is thinking…" /> : null}
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
            <Pressable key={a} testID="intake-chip" accessibilityRole="button" onPress={() => void send(a)} style={styles.chip}>
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
          <Text style={styles.summaryTitle}>What Pip understood</Text>
          <SummaryRow label="Topic" value={titleCase(view.context.goal.topic)} />
          <SummaryRow label="You want to" value={view.context.goal.outcome} />
          {view.context.goal.application ? <SummaryRow label="Where" value={view.context.goal.application} /> : null}
          <SummaryRow label="Starting point" value={levelLabel[view.context.experience.level]} />
          <SummaryRow label="Pace" value={horizonLabel[view.context.horizon]} />
          {view.context.facts.length ? <SummaryList label="You told me" items={view.context.facts} /> : null}
          {view.context.constraints.length ? <SummaryList label="Keeping in mind" items={view.context.constraints} /> : null}
          <Text style={styles.summaryNote}>Not right? Type a correction below before building.</Text>
        </View>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
    </Screen>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.muted },
  learnerRow: { alignItems: 'flex-end' },
  learnerBubble: { maxWidth: '85%', backgroundColor: colors.purple, padding: 14, borderRadius: 20, borderBottomRightRadius: 6 },
  learnerText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  companionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  companionBubble: { flex: 1, backgroundColor: colors.soft, padding: 14, borderRadius: 20, borderBottomLeftRadius: 6 },
  companionText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 3, borderColor: '#C4B5FD', backgroundColor: colors.bg },
  chipText: { fontFamily: fonts.black, fontSize: 14, color: colors.purple },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, minHeight: 56, borderWidth: 3, borderColor: '#C4B5FD', borderRadius: 18, paddingHorizontal: 16, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
  summary: { padding: 16, borderRadius: 22, backgroundColor: colors.mintTint, gap: 8 },
  summaryTitle: { fontFamily: fonts.black, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mintDeep },
  summaryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  summaryLabel: { width: 112, fontFamily: fonts.black, fontSize: 13, color: colors.mintDeep, paddingTop: 1 },
  summaryValue: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  summaryNote: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted, marginTop: 4 },
  planning: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  planningTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.ink, textAlign: 'center' },
  planningText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
});
