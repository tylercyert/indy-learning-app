import { z } from 'zod';
import { CompanionThemeV1Schema } from './companion';
import { ComponentResultV1Schema } from './components';
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
  /** Quick answers offered with a companion question; stored so the turn can be rebuilt on reload. */
  suggestedAnswers: z.array(z.string()).max(4).optional(),
});
export type IntakeMessage = z.infer<typeof IntakeMessageSchema>;

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
  /** Nodes whose learning experience is already generated for this learner: tapping opens instantly. */
  readyNodeIds: z.array(LocalIdSchema),
  /** Nodes whose experience is being written right now. */
  generatingNodeIds: z.array(LocalIdSchema),
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

export const UpdateCompanionRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('rename'), name: CompanionThemeV1Schema.shape.name }),
  z.strictObject({ action: z.literal('reroll') }),
]);
export type UpdateCompanionRequest = z.infer<typeof UpdateCompanionRequestSchema>;

/** Add a skill tree: continue after completion, or fold an exploration intake into the course. */
export const AddTreeRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('continue') }),
  z.strictObject({ kind: z.literal('explore'), intakeId: EntityIdSchema }),
]);
export type AddTreeRequest = z.infer<typeof AddTreeRequestSchema>;

// ---------- discovery ----------

/** Public projection of a discoverable course. Never includes the owner's learner context. */
export const DiscoverableCourseSchema = z.strictObject({
  courseId: EntityIdSchema,
  title: z.string(),
  subject: z.string(),
  summary: z.string(),
  companion: CompanionThemeV1Schema,
  lessonCount: z.int().min(1),
  firstLessons: z.array(z.string()).max(4),
});
export type DiscoverableCourse = z.infer<typeof DiscoverableCourseSchema>;

export const DiscoverListSchema = z.strictObject({ courses: z.array(DiscoverableCourseSchema) });

export const StartFromDiscoveredRequestSchema = z.strictObject({
  goal: z.string().trim().max(500).optional(),
});

// ---------- experiences and events ----------

export const ExperienceViewSchema = z.strictObject({
  experience: LearningExperienceV1Schema,
  viewedSlideIds: z.array(LocalIdSchema),
  /** Recorded results, latest attempt per component. */
  results: z.array(ComponentResultV1Schema),
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
  z.strictObject({
    type: z.literal('fillBlank'),
    slideId: LocalIdSchema,
    componentId: LocalIdSchema,
    /** One entry per gap the learner filled; missing gaps score as empty. */
    answers: z.array(z.strictObject({ gapId: LocalIdSchema, value: z.string().max(60) })).min(1).max(2),
  }),
  z.strictObject({
    type: z.literal('matchPairs'),
    slideId: LocalIdSchema,
    componentId: LocalIdSchema,
    /** Every pair exactly once: which right-hand item (by its pair id) the learner put on each pair. */
    matches: z.array(z.strictObject({ pairId: LocalIdSchema, chosenPairId: LocalIdSchema })).min(3).max(5),
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
  /** Present for fillBlank answers: every gap in component order; wrong gaps carry their explanation, right ones "". */
  scoredFillBlank: z
    .strictObject({
      correct: z.boolean(),
      attempt: z.int(),
      gaps: z.array(z.strictObject({ gapId: LocalIdSchema, correct: z.boolean(), explanation: z.string().max(200) })).min(1).max(2),
    })
    .nullable(),
  /** Present for matchPairs answers: every pair in component order; wrong matches carry their explanation, right ones "". */
  scoredMatchPairs: z
    .strictObject({
      correct: z.boolean(),
      attempt: z.int(),
      matches: z.array(z.strictObject({ pairId: LocalIdSchema, correct: z.boolean(), explanation: z.string().max(160) })).min(3).max(5),
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
