import type { ComponentV1, MultipleChoiceResultSchema } from '../contracts/components';
import type { z } from 'zod';

type MultipleChoice = Extract<ComponentV1, { type: 'multipleChoice' }>;
type MultipleChoiceResult = z.infer<typeof MultipleChoiceResultSchema>;

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
