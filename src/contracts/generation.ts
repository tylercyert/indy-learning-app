import { z } from 'zod';
import { CompanionThemeV1Schema } from './companion';
import { EntityIdSchema, LocalIdSchema, MediumTextSchema, ShortTextSchema } from './ids';
import { LearnerContextV1Schema } from './learner';
import { LessonDifficultySchema } from './lesson';
import { NodeKindSchema, ProgressionRuleV1Schema, assertTreeShape, kindMatchesRequired, ruleReferences } from './skill-tree';

/**
 * Shapes the model returns. Each is also the structured-output schema for its request,
 * so validation at the trust boundary and the generation contract are one definition.
 * Server code adds ids, ownership and timestamps after validation.
 */

/** One intake turn: either ask one more question, or declare the context complete. */
export const IntakeTurnV1Schema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ask'),
    /** Spoken by the companion. One question only. */
    question: MediumTextSchema,
    /** Tappable quick answers; the learner can always type instead. */
    suggestedAnswers: z.array(ShortTextSchema.max(40)).max(4),
  }),
  z.strictObject({
    kind: z.literal('ready'),
    context: LearnerContextV1Schema,
    /** One or two sentences the companion says to confirm what it understood. */
    summary: MediumTextSchema,
  }),
]);
export type IntakeTurnV1 = z.infer<typeof IntakeTurnV1Schema>;

/** A node in a plan: either reuses an existing lesson by id or defines a new one. */
export const PlannedLessonSchema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('reuse'), lessonId: EntityIdSchema }),
  z.strictObject({
    source: z.literal('new'),
    difficulty: LessonDifficultySchema,
    estimatedMinutes: z.int().min(2).max(45),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(8),
  }),
]);

export const PlannedNodeV1Schema = z
  .strictObject({
    id: LocalIdSchema,
    title: ShortTextSchema.max(80),
    objective: MediumTextSchema,
    kind: NodeKindSchema,
    required: z.boolean(),
    rule: ProgressionRuleV1Schema,
    lesson: PlannedLessonSchema,
  })
  .refine(kindMatchesRequired, { message: 'kind "optional" must have required=false and every other kind required=true', path: ['required'] });
export type PlannedNodeV1 = z.infer<typeof PlannedNodeV1Schema>;

/** CoursePlanV1: the structure of a new course or of an additional skill tree. */
export const CoursePlanV1Schema = z
  .strictObject({
    title: ShortTextSchema.max(80),
    subject: z.string().trim().toLowerCase().min(1).max(40),
    summary: MediumTextSchema,
    treeTitle: ShortTextSchema.max(80),
    companion: CompanionThemeV1Schema,
    nodes: z.array(PlannedNodeV1Schema).min(2).max(20),
  })
  .superRefine((plan, ctx) => {
    assertTreeShape(plan.nodes, ctx);
    const orientation = plan.nodes.filter((n) => n.kind === 'orientation');
    if (orientation.length !== 1) {
      ctx.addIssue({ code: 'custom', message: 'a plan needs exactly one orientation node', path: ['nodes'] });
    } else if (ruleReferences(orientation[0]!.rule).length > 0) {
      ctx.addIssue({ code: 'custom', message: 'the orientation node must be a root', path: ['nodes'] });
    }
  });
export type CoursePlanV1 = z.infer<typeof CoursePlanV1Schema>;

/** A plan for an additional skill tree inside an existing course: no companion, no course title. */
export const TreePlanV1Schema = z
  .strictObject({
    treeTitle: ShortTextSchema.max(80),
    nodes: z.array(PlannedNodeV1Schema).min(2).max(20),
  })
  .superRefine((plan, ctx) => assertTreeShape(plan.nodes, ctx));
export type TreePlanV1 = z.infer<typeof TreePlanV1Schema>;
