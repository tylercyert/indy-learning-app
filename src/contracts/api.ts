import { z } from 'zod';
import { CompanionThemeV1Schema } from './companion';
import { CourseV1Schema } from './course';
import { IntakeTurnV1Schema } from './generation';
import { StreakV1Schema } from './history';
import { EntityIdSchema, LocalIdSchema, MediumTextSchema } from './ids';
import { LearnerContextV1Schema } from './learner';
import { LearningExperienceV1Schema } from './lesson';
import { SkillTreeV1Schema } from './skill-tree';

/**
 * HTTP request and response shapes shared by client and server.
 * Requests are validated on the server; responses are validated on the client.
 */

// ---------- intake ----------

export const StartIntakeRequestSchema = z.strictObject({
  goal: z.string().trim().min(2).max(500),
  /** Present when this intake is an exploration request inside an existing course. */
  courseId: EntityIdSchema.optional(),
});
export type StartIntakeRequest = z.infer<typeof StartIntakeRequestSchema>;

export const IntakeReplyRequestSchema = z.strictObject({
  answer: z.string().trim().min(1).max(500),
});
export type IntakeReplyRequest = z.infer<typeof IntakeReplyRequestSchema>;

export const IntakeMessageSchema = z.strictObject({
  role: z.enum(['companion', 'learner']),
  text: z.string(),
  at: z.iso.datetime(),
});

export const IntakeStatusSchema = z.enum(['open', 'ready', 'planned', 'abandoned']);

export const IntakeSessionViewSchema = z.strictObject({
  id: EntityIdSchema,
  status: IntakeStatusSchema,
  courseId: EntityIdSchema.nullable(),
  transcript: z.array(IntakeMessageSchema),
  /** The latest model turn; null once planned. */
  turn: IntakeTurnV1Schema.nullable(),
  questionsAsked: z.int().min(0),
  context: LearnerContextV1Schema.nullable(),
});
export type IntakeSessionView = z.infer<typeof IntakeSessionViewSchema>;

// ---------- courses ----------

export const CreateCourseRequestSchema = z.strictObject({
  intakeId: EntityIdSchema,
});
export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;

export const NodeStateSchema = z.enum(['locked', 'available', 'completed']);

export const TreeViewSchema = z.strictObject({
  tree: SkillTreeV1Schema,
  nodeStates: z.record(LocalIdSchema, NodeStateSchema),
  nextNodeId: LocalIdSchema.nullable(),
  progress: z.strictObject({ completed: z.int(), required: z.int(), total: z.int() }),
  complete: z.boolean(),
});
export type TreeView = z.infer<typeof TreeViewSchema>;

export const CourseViewSchema = z.strictObject({
  course: CourseV1Schema,
  trees: z.array(TreeViewSchema).min(1),
  streak: StreakV1Schema,
});
export type CourseView = z.infer<typeof CourseViewSchema>;

export const CourseSummarySchema = z.strictObject({
  course: CourseV1Schema,
  progress: z.strictObject({ completed: z.int(), required: z.int(), total: z.int() }),
  nextNodeTitle: z.string().nullable(),
});
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

export const CourseListSchema = z.strictObject({
  courses: z.array(CourseSummarySchema),
  streak: StreakV1Schema,
});
export type CourseList = z.infer<typeof CourseListSchema>;

export const UpdateCompanionRequestSchema = z.strictObject({
  name: CompanionThemeV1Schema.shape.name.optional(),
  reroll: z.boolean().optional(),
});

// ---------- experiences and events ----------

export const ExperienceViewSchema = z.strictObject({
  experience: LearningExperienceV1Schema,
  viewedSlideIds: z.array(LocalIdSchema),
  /** Recorded results, latest attempt per component. */
  results: z.array(
    z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('multipleChoice'), componentId: LocalIdSchema, selectedOptionId: LocalIdSchema, correct: z.boolean(), attempt: z.int() }),
      z.strictObject({ type: z.literal('checklist'), componentId: LocalIdSchema, checkedItemIds: z.array(LocalIdSchema), confirmed: z.boolean() }),
    ]),
  ),
  completed: z.boolean(),
});
export type ExperienceView = z.infer<typeof ExperienceViewSchema>;

export const ExperienceEventRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('slideViewed'), slideId: LocalIdSchema }),
  z.strictObject({
    type: z.literal('answer'),
    slideId: LocalIdSchema,
    componentId: LocalIdSchema,
    selectedOptionId: LocalIdSchema,
  }),
  z.strictObject({
    type: z.literal('checklist'),
    slideId: LocalIdSchema,
    componentId: LocalIdSchema,
    checkedItemIds: z.array(LocalIdSchema).max(8),
    confirmed: z.boolean(),
  }),
]).and(
  z.object({
    /** The learner's local calendar day, for the streak. Server date if absent. */
    localDate: z.iso.date().optional(),
  }),
);
export type ExperienceEventRequest = z.infer<typeof ExperienceEventRequestSchema>;

export const ExperienceEventResponseSchema = z.strictObject({
  /** Present for answers: the deterministic score and the teaching explanation. */
  scored: z
    .strictObject({
      correct: z.boolean(),
      explanation: MediumTextSchema,
      correctOptionId: LocalIdSchema,
      attempt: z.int(),
    })
    .nullable(),
  /** True the first time this event completes the lesson. */
  lessonCompleted: z.boolean(),
  treeCompleted: z.boolean(),
  streak: StreakV1Schema,
  view: ExperienceViewSchema,
});
export type ExperienceEventResponse = z.infer<typeof ExperienceEventResponseSchema>;

export const ApiErrorSchema = z.object({ error: z.string(), detail: z.unknown().optional() });
