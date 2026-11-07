import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { z } from 'zod';
import { FILL_BLANK_MARKER, type ComponentV1, type FillBlankResultSchema } from '../../contracts/components';
import { ChunkyButton } from '../ui/ChunkyButton';
import { colors, fonts } from '../theme';

type FillBlankComponent = Extract<ComponentV1, { type: 'fillBlank' }>;
const NBSP = ' ';
type Result = z.infer<typeof FillBlankResultSchema>;

export interface FillBlankFeedback {
  correct: boolean;
  /** Every gap, in component order. Wrong gaps carry their teaching explanation. */
  gaps: { gapId: string; correct: boolean; explanation: string }[];
  attempt: number;
}

/**
 * Type → Check → feedback. The sentence shows each gap as a numbered slot that mirrors what the
 * learner is typing in the field below it; scoring happens in src/domain (on the server in the
 * app, locally in the harness). Wrong gaps teach and can be retried; a fully correct answer locks.
 */
export function FillBlank({
  component,
  result,
  feedback,
  busy,
  onSubmit,
  feedbackInFooter = false,
}: {
  component: FillBlankComponent;
  result?: Result;
  feedback?: FillBlankFeedback;
  busy: boolean;
  /** Absent while the server cannot score this component yet: the Check button is then disabled. */
  onSubmit?: (answers: { gapId: string; value: string }[]) => void;
  /** The screen shows the explanation and the retry/continue action itself. */
  feedbackInFooter?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((result?.answers ?? []).map((a) => [a.gapId, a.value])));
  const solved = feedback?.correct ?? result?.correct ?? false;
  const locked = solved || busy;
  const pieces = component.text.split(FILL_BLANK_MARKER);
  const filled = component.gaps.every((g) => (values[g.id] ?? '').trim().length > 0);
  const gapState = (gapId: string) => feedback?.gaps.find((g) => g.gapId === gapId);

  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>Fill the gap</Text>
      <Text style={styles.prompt}>{component.prompt}</Text>
      <Text style={styles.sentence} accessibilityLabel={component.text.split(FILL_BLANK_MARKER).join(', blank, ')}>
        {pieces.map((piece, i) => {
          const gap = component.gaps[i];
          const state = gap ? gapState(gap.id) : undefined;
          return (
            <Text key={i}>
              {piece}
              {gap ? (
                // Non-breaking padding keeps the slot one unit so it never splits across a line break.
                <Text style={[styles.slot, state && (state.correct ? styles.slotRight : styles.slotWrong)]}>
                  {NBSP}
                  {(values[gap.id] ?? '').trim().replace(/ /g, NBSP) || `${NBSP}${i + 1}${NBSP.repeat(4)}`}
                  {NBSP}
                </Text>
              ) : null}
            </Text>
          );
        })}
      </Text>
      <View style={styles.fields}>
        {component.gaps.map((gap, i) => {
          const state = gapState(gap.id);
          return (
            <View key={gap.id} style={styles.field}>
              <Text style={styles.fieldLabel}>{component.gaps.length > 1 ? `Gap ${i + 1}` : 'Your answer'}</Text>
              <TextInput
                accessibilityLabel={`Gap ${i + 1} of ${component.gaps.length}`}
                value={values[gap.id] ?? ''}
                onChangeText={(text) => setValues((v) => ({ ...v, [gap.id]: text }))}
                editable={!locked}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={60}
                style={[styles.input, state && (state.correct ? styles.inputRight : styles.inputWrong), locked && styles.inputLocked]}
              />
            </View>
          );
        })}
      </View>

      {feedback && !feedbackInFooter ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackRight : styles.feedbackWrong]} accessibilityLiveRegion="polite">
          <Text style={styles.feedbackTitle}>{feedback.correct ? 'Nice!' : feedback.gaps.length > 1 ? 'Not quite. Check the marked gap' : 'Not quite. Here’s the idea'}</Text>
          {feedback.gaps
            .filter((g) => !g.correct)
            .map((g, i) => (
              <Text key={g.gapId} style={styles.feedbackText}>
                {feedback.gaps.length > 1 ? `Gap ${component.gaps.findIndex((x) => x.id === g.gapId) + 1}: ` : ''}
                {g.explanation}
              </Text>
            ))}
          {!feedback.correct && <Text style={styles.retry}>Change your answer and check again. No penalty either way.</Text>}
        </View>
      ) : null}

      {!solved && !(feedback && feedbackInFooter) && (
        <ChunkyButton
          label={feedback ? 'Check again' : 'Check'}
          onPress={() => onSubmit?.(component.gaps.map((g) => ({ gapId: g.id, value: values[g.id] ?? '' })))}
          disabled={!onSubmit || !filled}
          loading={busy}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.purpleTint, color: colors.purpleDeep, fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  prompt: { fontFamily: fonts.black, fontSize: 20, lineHeight: 26, color: colors.ink },
  sentence: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 30, color: colors.ink },
  slot: { fontFamily: fonts.black, backgroundColor: colors.soft, color: colors.purple, borderRadius: 6 },
  slotRight: { backgroundColor: colors.greenTint, color: colors.mintDeep },
  slotWrong: { backgroundColor: colors.coralTint, color: colors.coralDeep },
  fields: { gap: 10 },
  field: { gap: 4 },
  fieldLabel: { fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.muted },
  input: { minHeight: 52, paddingHorizontal: 14, borderRadius: 16, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.bg, fontFamily: fonts.extraBold, fontSize: 17, color: colors.ink },
  inputRight: { borderColor: colors.green, backgroundColor: colors.greenTint },
  inputWrong: { borderColor: colors.orangeLine, backgroundColor: colors.coralTint },
  inputLocked: { opacity: 0.8 },
  feedback: { padding: 14, borderRadius: 20, gap: 6 },
  feedbackRight: { backgroundColor: colors.greenTint },
  feedbackWrong: { backgroundColor: colors.coralTint },
  feedbackTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  feedbackText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  retry: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
