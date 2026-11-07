import type { ComponentV1, FillBlankResultSchema, MatchPairsResultSchema, MultipleChoiceResultSchema } from '../contracts/components';
import type { z } from 'zod';

type MultipleChoice = Extract<ComponentV1, { type: 'multipleChoice' }>;
type MultipleChoiceResult = z.infer<typeof MultipleChoiceResultSchema>;
type FillBlank = Extract<ComponentV1, { type: 'fillBlank' }>;
type FillBlankResult = z.infer<typeof FillBlankResultSchema>;
type MatchPairs = Extract<ComponentV1, { type: 'matchPairs' }>;
type MatchPairsResult = z.infer<typeof MatchPairsResultSchema>;

export interface ScoredChoice {
  result: MultipleChoiceResult;
  /** The explanation for the option the learner picked. Always present: wrong answers teach. */
  explanation: string;
  correctOptionId: string;
}

/**
 * Deterministic scoring. No model is involved and none ever will be for objective components.
 * Throws on an option id that is not on the component: that is a client bug, not a learner mistake.
 */
export function scoreMultipleChoice(
  component: MultipleChoice,
  selectedOptionId: string,
  attempt: number,
): ScoredChoice {
  const option = component.options.find((o) => o.id === selectedOptionId);
  if (!option) throw new Error(`option "${selectedOptionId}" is not on component "${component.id}"`);
  const correct = option.id === component.correctOptionId;
  return {
    result: { type: 'multipleChoice', componentId: component.id, selectedOptionId, correct, attempt },
    explanation: option.explanation,
    correctOptionId: component.correctOptionId,
  };
}

/** Typed answers compare after this: Unicode compatibility form, trimmed, case-folded, inner whitespace collapsed. */
export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ScoredFillBlank {
  result: FillBlankResult;
  /** Explanations for the gaps that were wrong, in component order. Empty when every gap matched. */
  explanations: { gapId: string; explanation: string }[];
}

/**
 * Deterministic scoring for fillBlank. Every gap must be answered (a missing gap counts as the
 * empty string, which never matches). Throws on an answer for a gap that is not on the component.
 */
export function scoreFillBlank(
  component: FillBlank,
  answers: readonly { gapId: string; value: string }[],
  attempt: number,
): ScoredFillBlank {
  const known = new Set(component.gaps.map((g) => g.id));
  for (const a of answers) {
    if (!known.has(a.gapId)) throw new Error(`gap "${a.gapId}" is not on component "${component.id}"`);
  }
  const scored = component.gaps.map((gap) => {
    const value = answers.find((a) => a.gapId === gap.id)?.value ?? '';
    const normalized = normalizeAnswer(value);
    const correct = normalized.length > 0 && gap.accepted.some((a) => normalizeAnswer(a) === normalized);
    return { gapId: gap.id, value: value.slice(0, 60), correct };
  });
  return {
    result: { type: 'fillBlank', componentId: component.id, answers: scored, correct: scored.every((s) => s.correct), attempt },
    explanations: component.gaps.filter((_, i) => !scored[i]!.correct).map((g) => ({ gapId: g.id, explanation: g.explanation })),
  };
}

export interface ScoredMatchPairs {
  result: MatchPairsResult;
  /** Explanations for the pairs matched wrongly, in component order. Empty when every match agrees. */
  explanations: { pairId: string; explanation: string }[];
}

/**
 * Deterministic scoring for matchPairs. Every pair must be matched exactly once; a missing pair or
 * an id that is not on the component is a client bug and throws.
 */
export function scoreMatchPairs(
  component: MatchPairs,
  matches: readonly { pairId: string; chosenPairId: string }[],
  attempt: number,
): ScoredMatchPairs {
  const ids = new Set(component.pairs.map((p) => p.id));
  for (const m of matches) {
    if (!ids.has(m.pairId) || !ids.has(m.chosenPairId)) throw new Error(`pair "${m.pairId}"→"${m.chosenPairId}" is not on component "${component.id}"`);
  }
  const scored = component.pairs.map((pair) => {
    const found = matches.filter((m) => m.pairId === pair.id);
    if (found.length !== 1) throw new Error(`pair "${pair.id}" must be matched exactly once on component "${component.id}"`);
    const chosenPairId = found[0]!.chosenPairId;
    return { pairId: pair.id, chosenPairId, correct: chosenPairId === pair.id };
  });
  const correctCount = scored.filter((s) => s.correct).length;
  return {
    result: { type: 'matchPairs', componentId: component.id, matches: scored, correctCount, correct: correctCount === scored.length, attempt },
    explanations: component.pairs.filter((_, i) => !scored[i]!.correct).map((p) => ({ pairId: p.id, explanation: p.explanation })),
  };
}
