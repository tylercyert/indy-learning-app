import { GoalScreeningV1Schema, type GoalScreeningV1, type LearnerContextV1, type ScreeningCategory } from '../../../src/contracts';
import { generateStructured, GenerationError } from '../ai/claude';
import { SCREENING_SYSTEM, screeningUserMessage } from '../ai/prompts';

/** Small, fast classifier model; the verdict is validated against GoalScreeningV1 like every model output. */
export const SCREENING_MODEL = 'claude-haiku-5-5';

/** Thrown when a goal may not become a course. `message` is the companion's learner-facing text. */
export class GoalRefusedError extends Error {
  constructor(
    public readonly category: ScreeningCategory,
    learnerMessage: string,
    public readonly rationale: string,
  ) {
    super(learnerMessage);
    this.name = 'GoalRefusedError';
  }
}

/**
 * Goal Screening runs twice per course: on the raw goal before the first intake question, and on
 * the completed intake context before planning (an innocent goal can be steered during intake).
 * It fails closed: if the classifier cannot answer, no course is planned.
 */
export async function screenGoal(goal: string, context?: LearnerContextV1): Promise<GoalScreeningV1> {
  let verdict: GoalScreeningV1;
  try {
    const { data } = await generateStructured({
      task: context ? 'screen:context' : 'screen:goal',
      model: SCREENING_MODEL,
      fast: false,
      schema: GoalScreeningV1Schema,
      system: SCREENING_SYSTEM,
      messages: [{ role: 'user', content: screeningUserMessage(goal, context) }],
      effort: 'low',
      maxTokens: 1500,
    });
    verdict = data;
  } catch (error) {
    if (error instanceof GenerationError && error.kind === 'refused') {
      // The model itself declined to engage: treat as a refusal of the goal.
      throw new GoalRefusedError('policy-other', "That's not something I can help teach. Want to pick something nearby we can learn together?", 'model refusal');
    }
    throw error;
  }
  if (verdict.decision === 'refuse') {
    console.warn(`[screen] refused (${verdict.category}): ${verdict.rationale}`);
    throw new GoalRefusedError(verdict.category, verdict.learnerMessage, verdict.rationale);
  }
  return verdict;
}
