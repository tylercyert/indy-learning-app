import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BASE_COMPANION, type IntakeSessionView } from '../../src/contracts';
import { Companion } from '../../src/features/companion/Companion';
import { colors, fonts } from '../../src/features/theme';
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
      const course = await api.createCourse(view.id);
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
          <Companion theme={BASE_COMPANION} mood="thinking" size={120} />
          <Text style={styles.planningTitle}>Planning your course…</Text>
          <Text style={styles.planningText}>Pip is laying out the path, picking a companion for it, and writing your first lesson. About a minute.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        view && turn?.kind === 'ask' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.chips}>
              {turn.suggestedAnswers.map((a) => (
                <Pressable key={a} accessibilityRole="button" disabled={sending} onPress={() => void send(a)} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput
                accessibilityLabel="Your answer"
                placeholder="Type your answer"
                placeholderTextColor="#9B94B3"
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
          <ChunkyButton label="Build my course" onPress={() => void build()} />
        ) : null
      }
    >
      <View style={styles.header}>
        <BackButton label="Back to home" onPress={() => router.replace('/')} />
        <Text style={styles.headerText}>{view ? `Question ${Math.min(view.questionsAsked, 4)} of up to 4` : ''}</Text>
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
          <Text style={styles.summaryLine}>Topic: {view.context.goal.topic}</Text>
          <Text style={styles.summaryLine}>Outcome: {view.context.goal.outcome}</Text>
          <Text style={styles.summaryLine}>Experience: {view.context.experience.level} · Horizon: {view.context.horizon}</Text>
          {view.context.facts.length ? <Text style={styles.summaryLine}>Facts: {view.context.facts.join('; ')}</Text> : null}
          {view.context.constraints.length ? <Text style={styles.summaryLine}>Constraints: {view.context.constraints.join('; ')}</Text> : null}
        </View>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
    </Screen>
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
  summary: { padding: 16, borderRadius: 22, backgroundColor: colors.mintTint, gap: 6 },
  summaryTitle: { fontFamily: fonts.black, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mintDeep },
  summaryLine: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  planning: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  planningTitle: { fontFamily: fonts.black, fontSize: 24, color: colors.ink, textAlign: 'center' },
  planningText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' },
});
