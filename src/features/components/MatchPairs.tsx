import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import type { z } from 'zod';
import type { ComponentV1, MatchPairsResultSchema } from '../../contracts/components';
import { glyphBoxSize } from '../ui/a11y';
import { announce } from '../ui/announce';
import { ChunkyButton } from '../ui/ChunkyButton';
import { useRadioKeys } from '../ui/useRadioKeys';
import { colors, fonts, palette } from '../theme';

type MatchPairsComponent = Extract<ComponentV1, { type: 'matchPairs' }>;
type Result = z.infer<typeof MatchPairsResultSchema>;

export interface MatchPairsFeedback {
  correct: boolean;
  /** Every pair, in component order. Wrong matches carry their teaching explanation. */
  matches: { pairId: string; correct: boolean; explanation: string }[];
  attempt: number;
}

const SLOT_COLORS = ['primary', 'accent', 'highlight', 'secondary', 'neutral'] as const;

/** Stable pseudo-random order for the right column, derived from the ids alone (no shuffle field in the contract). */
function shuffledOrder(ids: readonly string[]): string[] {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return [...ids].sort((a, b) => hash(a) - hash(b) || a.localeCompare(b));
}

/**
 * Tap a term, then tap the row it belongs to. Stacked rather than side by side, so it works at
 * 318px and with the largest accessibility text: terms are chips that wrap, matches are full-width
 * rows with a 52px target. Each pairing gets a colour and a number shared between chip and row.
 * Scoring happens in src/domain (server in the app, locally in the harness); wrong matches teach
 * and can be redone; a fully correct answer locks.
 */
export function MatchPairs({
  component,
  result,
  feedback,
  busy,
  onSubmit,
  feedbackInFooter = false,
}: {
  component: MatchPairsComponent;
  result?: Result;
  feedback?: MatchPairsFeedback;
  busy: boolean;
  /** Absent while the server cannot score this component yet: the Check button is then disabled. */
  onSubmit?: (matches: { pairId: string; chosenPairId: string }[]) => void;
  /** The screen shows the explanation and the retry/continue action itself. */
  feedbackInFooter?: boolean;
}) {
  // matches: left pair id → right pair id chosen for it.
  const [matches, setMatches] = useState<Record<string, string>>(() => Object.fromEntries((result?.matches ?? []).map((m) => [m.pairId, m.chosenPairId])));
  const [picked, setPicked] = useState<string | null>(null);
  const solved = feedback?.correct ?? result?.correct ?? false;
  const locked = solved || busy;
  const rightOrder = useMemo(() => shuffledOrder(component.pairs.map((p) => p.id)), [component.pairs]);
  const byId = new Map(component.pairs.map((p) => [p.id, p] as const));
  const slotIndex = (leftId: string) => component.pairs.findIndex((p) => p.id === leftId);
  const leftFor = (rightId: string) => Object.entries(matches).find(([, r]) => r === rightId)?.[0];
  const complete = component.pairs.every((p) => !!matches[p.id]);
  const stateFor = (leftId: string) => feedback?.matches.find((m) => m.pairId === leftId);

  const pick = (leftId: string | null) => {
    setPicked(leftId);
    const term = leftId ? byId.get(leftId)?.left : null;
    if (term) announce(`Now choose where ${term} belongs.`);
  };
  // The terms are one radio group: one tab stop, arrows move and pick, Space picks (web keyboard).
  const pickedIndex = component.pairs.findIndex((p) => p.id === picked);
  const { radioProps, focusRadio } = useRadioKeys({
    count: component.pairs.length,
    checkedIndex: pickedIndex,
    select: (i) => pick(component.pairs[i]!.id),
    disabled: locked,
  });
  // Number and slot badges grow with the OS text size, so the digit keeps its margin at 200%.
  const fontScale = PixelRatio.getFontScale();
  const numberBox = glyphBoxSize(28, fontScale);
  const slotBox = glyphBoxSize(32, fontScale);

  const onRight = (rightId: string) => {
    if (locked || !picked) return;
    const next = { ...matches };
    // A row holds one term: taking it from another term frees that term.
    for (const [l, r] of Object.entries(next)) if (r === rightId) delete next[l];
    next[picked] = rightId;
    setMatches(next);
    setPicked(null);
    announce(`${byId.get(picked)?.left ?? ''} matched with ${byId.get(rightId)?.right ?? ''}.`);
    // Keyboard flow: back to the next term still without a row (after this one, wrapping).
    const from = component.pairs.findIndex((p) => p.id === picked);
    for (let k = 1; k <= component.pairs.length; k++) {
      const i = (from + k) % component.pairs.length;
      if (!next[component.pairs[i]!.id]) {
        focusRadio(i);
        break;
      }
    }
  };

  // Feedback shown here (not in the screen's footer) is announced through the app's live region.
  useEffect(() => {
    if (!feedback || feedbackInFooter) return;
    const wrong = feedback.matches.filter((m) => !m.correct);
    announce(feedback.correct ? 'All matched!' : `${feedback.matches.length - wrong.length} of ${feedback.matches.length} right. ${wrong.map((m) => `${byId.get(m.pairId)?.left}: ${m.explanation}`).join(' ')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce each new result once
  }, [feedback, feedbackInFooter]);
  // "Try again" clears the footer's explanation: put the keyboard on the first term to move.
  const hadFeedback = useRef(!!feedback);
  const lastFeedback = useRef(feedback);
  useEffect(() => {
    if (hadFeedback.current && !feedback && !locked) {
      const firstWrong = component.pairs.findIndex((p) => lastFeedback.current?.matches.some((m) => m.pairId === p.id && !m.correct));
      focusRadio(Math.max(0, firstWrong));
    }
    hadFeedback.current = !!feedback;
    if (feedback) lastFeedback.current = feedback;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when feedback appears or clears
  }, [feedback]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.badge}>Match them up</Text>
      <Text style={styles.prompt}>{component.prompt}</Text>
      <Text style={styles.hint}>{picked ? 'Now tap where it belongs.' : 'Tap a term, then tap where it belongs.'}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {component.pairs.map((pair, i) => {
          const matched = !!matches[pair.id];
          const state = stateFor(pair.id);
          const c = palette[SLOT_COLORS[i]!];
          const isPicked = picked === pair.id;
          return (
            <Pressable
              key={pair.id}
              accessibilityRole="radio"
              aria-checked={isPicked}
              aria-disabled={locked}
              accessibilityLabel={`${pair.left}${matched ? `, matched with ${byId.get(matches[pair.id]!)?.right ?? ''}` : ''}`}
              disabled={locked}
              onPress={() => pick(isPicked ? null : pair.id)}
              {...radioProps(i)}
              style={[
                styles.chip,
                matched && { backgroundColor: c.fill, borderColor: c.fill },
                isPicked && styles.chipPicked,
                state && (state.correct ? styles.chipRight : styles.chipWrong),
              ]}
            >
              <View style={[styles.number, { minWidth: numberBox, minHeight: numberBox, borderRadius: numberBox / 2 }, matched && { backgroundColor: c.shadow }]}>
                <Text style={[styles.numberText, matched && { color: '#FFFFFF' }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.chipText, matched && { color: c.text }]}>{pair.left}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.rows}>
        {rightOrder.map((rightId) => {
          const pair = byId.get(rightId)!;
          const leftId = leftFor(rightId);
          const idx = leftId ? slotIndex(leftId) : -1;
          const c = idx >= 0 ? palette[SLOT_COLORS[idx]!] : undefined;
          const state = leftId ? stateFor(leftId) : undefined;
          return (
            <Pressable
              key={rightId}
              accessibilityRole="button"
              aria-disabled={locked || !picked}
              accessibilityLabel={`${pair.right}${leftId ? `, holds ${byId.get(leftId)?.left ?? ''}` : ''}`}
              accessibilityHint={picked ? 'Places the picked term here' : 'Pick a term first'}
              disabled={locked}
              onPress={() => onRight(rightId)}
              style={[styles.row, picked && !locked && styles.rowTarget, state && (state.correct ? styles.rowRight : styles.rowWrong)]}
            >
              <View style={[styles.slot, { minWidth: slotBox, minHeight: slotBox, borderRadius: Math.round(slotBox * 0.3) }, c && { backgroundColor: c.fill }]}>
                {idx >= 0 ? <Text style={[styles.slotText, { color: c!.text }]}>{idx + 1}</Text> : <Text style={styles.slotEmpty}>?</Text>}
              </View>
              <Text style={styles.rowText}>{pair.right}</Text>
            </Pressable>
          );
        })}
      </View>

      {feedback && !feedbackInFooter ? (
        <View style={[styles.feedback, feedback.correct ? styles.feedbackRight : styles.feedbackWrong]}>
          <Text style={styles.feedbackTitle}>{feedback.correct ? 'All matched!' : `${feedback.matches.filter((m) => m.correct).length} of ${feedback.matches.length} right. Look at the marked ones`}</Text>
          {feedback.matches
            .filter((m) => !m.correct)
            .map((m) => (
              <Text key={m.pairId} style={styles.feedbackText}>
                {byId.get(m.pairId)?.left}: {m.explanation}
              </Text>
            ))}
          {!feedback.correct && <Text style={styles.retry}>Move the marked terms and check again. No penalty either way.</Text>}
        </View>
      ) : null}

      {!solved && !(feedback && feedbackInFooter) && (
        <ChunkyButton
          label={feedback ? 'Check again' : 'Check'}
          onPress={() => onSubmit?.(component.pairs.map((p) => ({ pairId: p.id, chosenPairId: matches[p.id]! })))}
          disabled={!onSubmit || !complete}
          loading={busy}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.mintTint, color: colors.mintDeep, fontFamily: fonts.black, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  prompt: { fontFamily: fonts.black, fontSize: 20, lineHeight: 26, color: colors.ink },
  hint: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, maxWidth: '100%', paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 999, borderWidth: 3, borderColor: colors.control, backgroundColor: colors.bg },
  chipPicked: { borderColor: colors.purple, backgroundColor: colors.soft },
  chipRight: { borderColor: colors.green },
  chipWrong: { borderColor: colors.coralDeep, borderStyle: 'dashed' },
  number: { paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  numberText: { fontFamily: fonts.black, fontSize: 13, color: colors.muted },
  chipText: { flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 12, borderRadius: 16, borderWidth: 3, borderColor: colors.control, backgroundColor: colors.bg },
  // "Place it here" is a state, so its edge needs 3:1 too: purple, dashed.
  rowTarget: { borderColor: colors.purple, borderStyle: 'dashed' },
  rowRight: { borderColor: colors.green, backgroundColor: colors.greenTint },
  rowWrong: { borderColor: colors.orangeLine, backgroundColor: colors.coralTint },
  slot: { paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  slotText: { fontFamily: fonts.black, fontSize: 14 },
  slotEmpty: { fontFamily: fonts.black, fontSize: 14, color: colors.muted },
  rowText: { flex: 1, minWidth: 0, fontFamily: fonts.extraBold, fontSize: 15, lineHeight: 21, color: colors.ink },
  feedback: { padding: 14, borderRadius: 20, gap: 6 },
  feedbackRight: { backgroundColor: colors.greenTint },
  feedbackWrong: { backgroundColor: colors.coralTint },
  feedbackTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  feedbackText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  retry: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
});
