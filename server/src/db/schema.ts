import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type {
  CourseV1,
  HistoryEventV1,
  IntakeMessage,
  LearnerContextV1,
  LearningExperienceV1,
  LessonV1,
  SkillTreeV1,
} from '../../../src/contracts';

/**
 * Storage model. Documents are stored as validated JSON next to the columns we query by.
 * Every document carries its own schemaVersion; readers validate on load (see repositories).
 * SQLite today via Drizzle; the same schema module targets Postgres with a driver swap.
 */

export const learners = sqliteTable('learners', {
  id: text('id').primaryKey(),
  /** Opaque bearer token for the anonymous session. Rotatable. */
  token: text('token').notNull().unique(),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
});

export const courses = sqliteTable(
  'courses',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id').notNull().references(() => learners.id),
    subject: text('subject').notNull(),
    status: text('status').notNull(),
    discoverable: integer('discoverable', { mode: 'boolean' }).notNull().default(false),
    doc: text('doc', { mode: 'json' }).$type<CourseV1>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('courses_learner_idx').on(t.learnerId), index('courses_discoverable_idx').on(t.discoverable)],
);

export const skillTrees = sqliteTable(
  'skill_trees',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').notNull().references(() => courses.id),
    sequence: integer('sequence').notNull(),
    doc: text('doc', { mode: 'json' }).$type<SkillTreeV1>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('skill_trees_course_idx').on(t.courseId)],
);

export const lessons = sqliteTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    subject: text('subject').notNull(),
    objective: text('objective').notNull(),
    contentVersion: integer('content_version').notNull(),
    doc: text('doc', { mode: 'json' }).$type<LessonV1>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('lessons_subject_idx').on(t.subject)],
);

export const learningExperiences = sqliteTable(
  'learning_experiences',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id').notNull().references(() => lessons.id),
    learnerId: text('learner_id').notNull().references(() => learners.id),
    courseId: text('course_id').notNull().references(() => courses.id),
    doc: text('doc', { mode: 'json' }).$type<LearningExperienceV1>().notNull(),
    generatedAt: text('generated_at').notNull(),
  },
  (t) => [index('experiences_lookup_idx').on(t.learnerId, t.courseId, t.lessonId)],
);

export const historyEvents = sqliteTable(
  'history_events',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id').notNull().references(() => learners.id),
    type: text('type').notNull(),
    courseId: text('course_id'),
    lessonId: text('lesson_id'),
    at: text('at').notNull(),
    doc: text('doc', { mode: 'json' }).$type<HistoryEventV1>().notNull(),
  },
  (t) => [index('history_learner_at_idx').on(t.learnerId, t.at), index('history_lesson_idx').on(t.learnerId, t.lessonId)],
);

export const lessonCompletions = sqliteTable(
  'lesson_completions',
  {
    learnerId: text('learner_id').notNull().references(() => learners.id),
    lessonId: text('lesson_id').notNull().references(() => lessons.id),
    lessonContentVersion: integer('lesson_content_version').notNull(),
    courseId: text('course_id').notNull(),
    experienceId: text('experience_id').notNull(),
    completedAt: text('completed_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.lessonId] })],
);

export const streaks = sqliteTable('streaks', {
  learnerId: text('learner_id').primaryKey().references(() => learners.id),
  count: integer('count').notNull().default(0),
  lastActiveDate: text('last_active_date'),
});

export type { IntakeMessage };

export const intakeSessions = sqliteTable(
  'intake_sessions',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id').notNull().references(() => learners.id),
    /** Set when the intake is an exploration request inside an existing course. */
    courseId: text('course_id'),
    status: text('status').notNull(), // open | ready | planned | abandoned
    transcript: text('transcript', { mode: 'json' }).$type<IntakeMessage[]>().notNull(),
    context: text('context', { mode: 'json' }).$type<LearnerContextV1 | null>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('intake_learner_idx').on(t.learnerId)],
);
