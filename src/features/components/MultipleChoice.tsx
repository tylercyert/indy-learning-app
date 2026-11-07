import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { z } from 'zod';
import type { ComponentV1, MultipleChoiceResultSchema } from '../../contracts/components';
import { ChunkyButton } from '../ui/ChunkyButton';
import { colors, fonts } from '../theme';

type Choice = Extract<ComponentV1, { type: 'multipleChoice' }>;
type Result = z.infer<typeof MultipleChoiceResultSchema>;

export interface ChoiceFeedback {
  correct: boolean;
  explanation: string;
  correctOptionId: string;
  attempt: number;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Pick → Check → feedback. Scoring happens on the server (pure domain code); this component only
 * collects the choice and shows the teaching explanation that comes back. Wrong answers can retry.
 */
export function MultipleChoice({
  component,
  result,
  feedback,
  busy,
  onSubmit,
}: {
  component: Choice;
  result?: Result;
  feedback?: ChoiceFeedback;
  busy: boolean;
  onSubmit: (optionId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(result?.selectedOptionId ?? null);
  const answeredCorrectly = feedback?.correct ?? result?.correct ?? false;
  const showFeedback = !!feedback;
  const locked = answeredCorrectly || busy;

  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>Quick check</Text>
      <Text style={styles.prompt}>{component.prompt}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {component.options.map((option, i) => {
          const isSelected = selected === option.id;
          // The correct option is highlighted only once the learner has found it; a wrong pick
          // shows its explanation and invites another try without giving the answer away.
          const isCorrect = showFeedback && feedback.correct && option.id === feedback.correctOptionId;
          const isWrongPick = showFeedback && isSelected && !feedback.correct;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              // aria-* props reach both web (react-native-web ignores accessibilityState) and native.
              aria-checked={isSelected}
              aria-disabled={locked}
              accessibilityLabel={`${LETTERS[i]}. ${option.text}`}
              disabled={locked}
              onPress={() => setSelected(option.id)}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
              ]}
            >
              <View style={[styles.letter, isSelected && styles.letterSelected, isCorrect && styles.letterCorrect]}>
                <Text style={[styles.letterText, (isSelected || isCorrect) && styles.letterTextSelected]}>{LETTERS[i]}</Text>
              </View>
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {showFeedback ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackRight : styles.feedbackWrong]} accessibilityLiveRegion="polite">
          <Text style={styles.feedbackTitle}>{feedback.correct ? 'Nice!' : 'Not quite. Here’s the idea'}</Text>
          <Text style={styles.feedbackText}>{feedback.explanation}</Text>
          {!feedback.correct && <Text style={styles.retry}>Want another go? Pick a different answer and check again. No penalty either way.</Text>}
        </View>
      ) : null}

      {!answeredCorrectly && (
        <ChunkyButton
          label={showFeedback ? 'Check again' : 'Check'}
          onPress={() => selected && onSubmit(selected)}
          disabled={!selected || (showFeedback && selected === result?.selectedOptionId)}
          loading={busy}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.yellowTint, color: '#92400E', fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  prompt: { fontFamily: fonts.black, fontSize: 20, lineHeight: 26, color: colors.ink },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.line, borderBottomWidth: 6, backgroundColor: colors.bg },
  optionSelected: { borderColor: colors.purple, backgroundColor: colors.soft },
  optionCorrect: { borderColor: colors.green, backgroundColor: colors.greenTint },
  optionWrong: { borderColor: colors.orangeLine, backgroundColor: colors.coralTint },
  // Minimum, not fixed: the badge grows with large accessibility text instead of clipping the letter.
  letter: { minWidth: 30, minHeight: 30, paddingHorizontal: 6, borderRadius: 9, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  letterSelected: { backgroundColor: colors.purple },
  letterCorrect: { backgroundColor: colors.mintDeep },
  letterText: { fontFamily: fonts.black, fontSize: 13, color: colors.muted },
  letterTextSelected: { color: '#FFFFFF' },
  optionText: { flex: 1, minWidth: 0, flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
  feedback: { padding: 14, borderRadius: 20, gap: 6 },
  feedbackRight: { backgroundColor: colors.greenTint },
  feedbackWrong: { backgroundColor: colors.coralTint },
  feedbackTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  feedbackText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  retry: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
