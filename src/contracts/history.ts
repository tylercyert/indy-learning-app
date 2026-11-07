import { z } from 'zod';
import { ComponentResultV1Schema } from './components';
import { EntityIdSchema, IsoDateSchema, IsoDateTimeSchema, LocalIdSchema, MediumTextSchema, ShortTextSchema } from './ids';

/**
 * Learning history: append-only evidence of what a learner did, across courses.
 * Course progress is a view over these events plus the course's progression rules.
 */
const base = {
  id: EntityIdSchema,
  learnerId: EntityIdSchema,
  at: IsoDateTimeSchema,
};

export const SlideViewedEventSchema = z.strictObject({
  ...base,
  type: z.literal('slideViewed'),
  courseId: EntityIdSchema,
  lessonId: EntityIdSchema,
  experienceId: EntityIdSchema,
  slideId: LocalIdSchema,
});

export const ComponentAnsweredEventSchema = z.strictObject({
  ...base,
  type: z.literal('componentAnswered'),
  courseId: EntityIdSchema,
  lessonId: EntityIdSchema,
  experienceId: EntityIdSchema,
  slideId: LocalIdSchema,
  result: ComponentResultV1Schema,
});

export const LessonCompletedEventSchema = z.strictObject({
  ...base,
  type: z.literal('lessonCompleted'),
  courseId: EntityIdSchema,
  lessonId: EntityIdSchema,
  lessonContentVersion: z.int().min(1),
  experienceId: EntityIdSchema,
});

export const CourseCompletedEventSchema = z.strictObject({
  ...base,
  type: z.literal('courseCompleted'),
  courseId: EntityIdSchema,
  skillTreeId: EntityIdSchema,
});

export const HistoryEventV1Schema = z.discriminatedUnion('type', [
  SlideViewedEventSchema,
  ComponentAnsweredEventSchema,
  LessonCompletedEventSchema,
  CourseCompletedEventSchema,
]);
export type HistoryEventV1 = z.infer<typeof HistoryEventV1Schema>;

/** A completion is recognized in every course that includes the lesson. */
export const LessonCompletionV1Schema = z.strictObject({
  learnerId: EntityIdSchema,
  lessonId: EntityIdSchema,
  lessonContentVersion: z.int().min(1),
  /** The course in which it was earned; recognition elsewhere is derived. */
  courseId: EntityIdSchema,
  experienceId: EntityIdSchema,
  completedAt: IsoDateTimeSchema,
});
export type LessonCompletionV1 = z.infer<typeof LessonCompletionV1Schema>;

/** One streak per learner across all courses. Dates are local calendar days (YYYY-MM-DD). */
export const StreakV1Schema = z.strictObject({
  count: z.int().min(0),
  lastActiveDate: IsoDateSchema.nullable(),
});
export type StreakV1 = z.infer<typeof StreakV1Schema>;

/**
 * LearningSummaryV1: the compact, task-relevant view of history that goes into generation context.
 * Built by code from events; never sent in full history form.
 */
export const LearningSummaryV1Schema = z.strictObject({
  completedLessons: z
    .array(
      z.strictObject({
        lessonId: EntityIdSchema,
        title: ShortTextSchema.max(80),
        objective: MediumTextSchema,
        subject: z.string().min(1).max(40),
        completedAt: IsoDateTimeSchema,
      }),
    )
    .max(40),
  /** Objectives where the learner answered wrong at least once recently, most missed first. */
  struggles: z.array(z.strictObject({ objective: MediumTextSchema, wrongAnswers: z.int().min(1) })).max(10),
  /** Objectives answered right on the first try. */
  strengths: z.array(MediumTextSchema).max(10),
});
export type LearningSummaryV1 = z.infer<typeof LearningSummaryV1Schema>;
