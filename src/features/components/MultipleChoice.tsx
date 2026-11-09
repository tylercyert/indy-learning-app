import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import type { z } from 'zod';
import type { ComponentV1, MultipleChoiceResultSchema } from '../../contracts/components';
import { glyphBoxSize } from '../ui/a11y';
import { announce } from '../ui/announce';
import { ChunkyButton } from '../ui/ChunkyButton';
import { useRadioKeys } from '../ui/useRadioKeys';
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
  feedbackInFooter = false,
}: {
  component: Choice;
  result?: Result;
  feedback?: ChoiceFeedback;
  busy: boolean;
  onSubmit: (optionId: string) => void;
  /** The screen shows the explanation and the retry/continue action itself; keep only the option colouring here. */
  feedbackInFooter?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(result?.selectedOptionId ?? null);
  const answeredCorrectly = feedback?.correct ?? result?.correct ?? false;
  const showFeedback = !!feedback;
  const locked = answeredCorrectly || busy;
  const selectedIndex = component.options.findIndex((o) => o.id === selected);
  const { radioProps, focusRadio } = useRadioKeys({
    count: component.options.length,
    checkedIndex: selectedIndex,
    select: (i) => setSelected(component.options[i]!.id),
    disabled: locked,
  });
  // The letter badge grows with the OS text size, so the letter keeps its margin at 200%.
  const badge = glyphBoxSize(30, PixelRatio.getFontScale());

  // Feedback shown here (not in the screen's footer) is announced through the app's live region.
  useEffect(() => {
    if (feedback && !feedbackInFooter) announce(`${feedback.correct ? 'Correct.' : 'Not quite.'} ${feedback.explanation}`);
  }, [feedback, feedbackInFooter]);
  // "Try again" clears the footer's explanation: put the keyboard back on the options.
  const hadFeedback = useRef(!!feedback);
  useEffect(() => {
    if (hadFeedback.current && !feedback && !locked) focusRadio(Math.max(0, selectedIndex));
    hadFeedback.current = !!feedback;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when feedback appears or clears
  }, [feedback]);

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
              {...radioProps(i)}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
              ]}
            >
              <View style={[styles.letter, { minWidth: badge, minHeight: badge, borderRadius: Math.round(badge * 0.3) }, isSelected && styles.letterSelected, isCorrect && styles.letterCorrect]}>
                <Text style={[styles.letterText, (isSelected || isCorrect) && styles.letterTextSelected]}>{LETTERS[i]}</Text>
              </View>
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {showFeedback && !feedbackInFooter ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackRight : styles.feedbackWrong]}>
          <Text style={styles.feedbackTitle}>{feedback.correct ? 'Nice!' : 'Not quite. Here’s the idea'}</Text>
          <Text style={styles.feedbackText}>{feedback.explanation}</Text>
          {!feedback.correct && <Text style={styles.retry}>Want another go? Pick a different answer and check again. No penalty either way.</Text>}
        </View>
      ) : null}

      {!answeredCorrectly && !(showFeedback && feedbackInFooter) && (
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
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.control, borderBottomWidth: 6, backgroundColor: colors.bg },
  optionSelected: { borderColor: colors.purple, backgroundColor: colors.soft },
  optionCorrect: { borderColor: colors.green, backgroundColor: colors.greenTint },
  optionWrong: { borderColor: colors.orangeLine, backgroundColor: colors.coralTint },
  // Sized from the OS text scale at render (glyphBoxSize), and still a minimum, so a letter never clips.
  letter: { paddingHorizontal: 6, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
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
