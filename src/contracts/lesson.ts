import { z } from 'zod';
import { EntityIdSchema, IsoDateTimeSchema, MediumTextSchema, ShortTextSchema, assertUniqueLocalIds } from './ids';
import { SlideV1Schema, slideHasAssessable } from './slide';

/**
 * LessonV1: a reusable unit of learning with one objective and a stable identity.
 * It owns no slides. Slides belong to a LearningExperience generated for one learner.
 */
export const LessonDifficultySchema = z.enum(['intro', 'core', 'advanced']);

export const LessonV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  id: EntityIdSchema,
  title: ShortTextSchema.max(80),
  /** The one capability this lesson teaches, in plain language. Basis for reuse decisions. */
  objective: MediumTextSchema,
  /** Broad subject label, lowercase, e.g. "mixology", "python", "indonesian". */
  subject: z.string().trim().toLowerCase().min(1).max(40),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(8),
  difficulty: LessonDifficultySchema,
  estimatedMinutes: z.int().min(2).max(45),
  /** Bumped when the lesson definition changes. Completions record the version they were earned on. */
  contentVersion: z.int().min(1),
  createdAt: IsoDateTimeSchema,
});
export type LessonV1 = z.infer<typeof LessonV1Schema>;

/** The slide list a generator returns. Ids and ownership are added by the server. */
export const GeneratedSlidesV1Schema = z
  .strictObject({
    slides: z.array(SlideV1Schema).min(2).max(12),
  })
  .superRefine((value, ctx) => {
    assertUniqueLocalIds(value.slides, ctx, 'slide');
    if (!value.slides.some(slideHasAssessable)) {
      ctx.addIssue({
        code: 'custom',
        message: 'a learning experience must include at least one assessable component',
        path: ['slides'],
      });
    }
  });
export type GeneratedSlidesV1 = z.infer<typeof GeneratedSlidesV1Schema>;

/** Orientation lessons stay short and preview-only (decision 2026-11-07, #21). */
export const ORIENTATION_MAX_SLIDES = 5;
export const ORIENTATION_MAX_TEACHING_SLIDES = 1;

/**
 * The slides of an orientation lesson: GeneratedSlidesV1 plus the orientation shape, so a long or
 * teaching-heavy orientation is fed back to the model and retried instead of stored.
 */
export const OrientationSlidesV1Schema = GeneratedSlidesV1Schema.superRefine((value, ctx) => {
  if (value.slides.length > ORIENTATION_MAX_SLIDES) {
    ctx.addIssue({ code: 'custom', message: `an orientation lesson has at most ${ORIENTATION_MAX_SLIDES} slides`, path: ['slides'] });
  }
  const teaching = value.slides.filter((s) => s.purpose === 'teach' || s.purpose === 'practice').length;
  if (teaching > ORIENTATION_MAX_TEACHING_SLIDES) {
    ctx.addIssue({
      code: 'custom',
      message: `an orientation lesson previews the course: at most ${ORIENTATION_MAX_TEACHING_SLIDES} slide with purpose teach or practice`,
      path: ['slides'],
    });
  }
});

/**
 * LearningExperienceV1: the instructional run of a lesson for one learner in one course.
 * Generated on demand when the learner first opens the node; validated before storage.
 */
export const LearningExperienceV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  id: EntityIdSchema,
  lessonId: EntityIdSchema,
  lessonContentVersion: z.int().min(1),
  learnerId: EntityIdSchema,
  courseId: EntityIdSchema,
  slides: GeneratedSlidesV1Schema.shape.slides,
  /** Which model produced it, for audit; never shown to learners. */
  generatedBy: z.string().min(1).max(60),
  generatedAt: IsoDateTimeSchema,
});
export type LearningExperienceV1 = z.infer<typeof LearningExperienceV1Schema>;
