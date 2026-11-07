import { z } from 'zod';
import { CompanionThemeV1Schema } from './companion';
import { EntityIdSchema, IsoDateTimeSchema, MediumTextSchema, ShortTextSchema } from './ids';
import { LearnerContextV1Schema } from './learner';

/**
 * CourseV1: one learner's journey toward one goal. Owns its skill trees (by id) and its companion.
 * Progress is not stored here; it is derived from lesson completions.
 */
export const CourseStatusSchema = z.enum(['planning', 'active', 'completed']);

export const CourseV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  id: EntityIdSchema,
  learnerId: EntityIdSchema,
  title: ShortTextSchema.max(80),
  subject: z.string().trim().toLowerCase().min(1).max(40),
  /** One-sentence description shown in course discovery. */
  summary: MediumTextSchema,
  context: LearnerContextV1Schema,
  companion: CompanionThemeV1Schema,
  status: CourseStatusSchema,
  /** Listed in course discovery for other learners. Structure is shared; experiences are not. */
  discoverable: z.boolean(),
  /** Set when this course was started from a discovered course. */
  sourceCourseId: EntityIdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CourseV1 = z.infer<typeof CourseV1Schema>;
