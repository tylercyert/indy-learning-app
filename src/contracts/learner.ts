import { z } from 'zod';
import { EntityIdSchema, IsoDateTimeSchema, MediumTextSchema, ShortTextSchema } from './ids';

/** LearnerV1: a person using the platform. Anonymous until an identity is linked. */
export const LearnerV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  id: EntityIdSchema,
  displayName: ShortTextSchema.max(40).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type LearnerV1 = z.infer<typeof LearnerV1Schema>;

/**
 * LearnerContextV1: what intake learned about one learner for one goal.
 * Self-reported. It shapes generation; it is never evidence of mastery.
 */
export const ExperienceLevelSchema = z.enum(['new', 'some', 'experienced']);
export const HorizonSchema = z.enum(['quickWin', 'steady', 'deep']);

export const LearnerContextV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  goal: z.strictObject({
    /** Short subject label the planner can reuse lessons by, lowercase. */
    topic: z.string().trim().toLowerCase().min(1).max(40),
    /** The learner's own words. */
    statement: MediumTextSchema,
    /** What success looks like for them. */
    outcome: MediumTextSchema,
    /** Where or when they will use it, if they said. */
    application: MediumTextSchema.nullable(),
  }),
  experience: z.strictObject({
    level: ExperienceLevelSchema,
    notes: MediumTextSchema.nullable(),
  }),
  horizon: HorizonSchema,
  /** Subject-specific facts intake asked about, e.g. "owns an acoustic guitar". */
  facts: z.array(ShortTextSchema).max(12),
  /** Things that limit the plan, e.g. "no alcohol", "15 minutes a day". */
  constraints: z.array(ShortTextSchema).max(8),
});
export type LearnerContextV1 = z.infer<typeof LearnerContextV1Schema>;
