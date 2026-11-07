import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  CourseV1Schema,
  LearningExperienceV1Schema,
  LessonV1Schema,
  SkillTreeV1Schema,
  StreakV1Schema,
  type CourseV1,
  type HistoryEventV1,
  type LearningExperienceV1,
  type LessonV1,
  type SkillTreeV1,
  type StreakV1,
} from '../../../src/contracts';
import { db } from '../db/client';
import { courses, historyEvents, learningExperiences, lessonCompletions, lessons, skillTrees, streaks } from '../db/schema';

/**
 * Read/write access to stored documents. Every read re-validates against its contract,
 * so a bad row surfaces as a schema error at the boundary rather than deep in a screen.
 */

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

export function getCourse(learnerId: string, courseId: string): CourseV1 {
  const row = db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.learnerId, learnerId))).get();
  if (!row) throw new NotFoundError('course');
  return CourseV1Schema.parse(row.doc);
}

export function getCourseAnyOwner(courseId: string): CourseV1 {
  const row = db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!row) throw new NotFoundError('course');
  return CourseV1Schema.parse(row.doc);
}

export function listCourses(learnerId: string): CourseV1[] {
  return db
    .select()
    .from(courses)
    .where(eq(courses.learnerId, learnerId))
    .orderBy(desc(courses.updatedAt))
    .all()
    .map((r) => CourseV1Schema.parse(r.doc));
}

export function saveCourse(course: CourseV1): void {
  db.insert(courses)
    .values({
      id: course.id,
      learnerId: course.learnerId,
      subject: course.subject,
      status: course.status,
      discoverable: course.discoverable,
      doc: course,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    })
    .onConflictDoUpdate({
      target: courses.id,
      set: { status: course.status, discoverable: course.discoverable, doc: course, updatedAt: course.updatedAt },
    })
    .run();
}

export function getTrees(courseId: string): SkillTreeV1[] {
  return db
    .select()
    .from(skillTrees)
    .where(eq(skillTrees.courseId, courseId))
    .orderBy(skillTrees.sequence)
    .all()
    .map((r) => SkillTreeV1Schema.parse(r.doc));
}

export function saveTree(tree: SkillTreeV1): void {
  db.insert(skillTrees)
    .values({ id: tree.id, courseId: tree.courseId, sequence: tree.sequence, doc: tree, createdAt: tree.createdAt })
    .run();
}

export function getLesson(lessonId: string): LessonV1 {
  const row = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
  if (!row) throw new NotFoundError('lesson');
  return LessonV1Schema.parse(row.doc);
}

export function getLessons(ids: string[]): Map<string, LessonV1> {
  if (ids.length === 0) return new Map();
  const rows = db.select().from(lessons).where(inArray(lessons.id, ids)).all();
  return new Map(rows.map((r) => [r.id, LessonV1Schema.parse(r.doc)] as const));
}

export function listLessonsBySubject(subject: string, limit = 30): LessonV1[] {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.subject, subject))
    .orderBy(desc(lessons.createdAt))
    .limit(limit)
    .all()
    .map((r) => LessonV1Schema.parse(r.doc));
}

export function saveLesson(lesson: LessonV1): void {
  db.insert(lessons)
    .values({
      id: lesson.id,
      subject: lesson.subject,
      objective: lesson.objective,
      contentVersion: lesson.contentVersion,
      doc: lesson,
      createdAt: lesson.createdAt,
    })
    .run();
}

export function findExperience(learnerId: string, courseId: string, lessonId: string): LearningExperienceV1 | null {
  const row = db
    .select()
    .from(learningExperiences)
    .where(
      and(
        eq(learningExperiences.learnerId, learnerId),
        eq(learningExperiences.courseId, courseId),
        eq(learningExperiences.lessonId, lessonId),
      ),
    )
    .orderBy(desc(learningExperiences.generatedAt))
    .get();
  return row ? LearningExperienceV1Schema.parse(row.doc) : null;
}

/** Lesson ids that already have a generated experience for this learner in this course. */
export function experienceLessonIds(learnerId: string, courseId: string): Set<string> {
  const rows = db
    .select({ lessonId: learningExperiences.lessonId })
    .from(learningExperiences)
    .where(and(eq(learningExperiences.learnerId, learnerId), eq(learningExperiences.courseId, courseId)))
    .all();
  return new Set(rows.map((r) => r.lessonId));
}

export function getExperience(learnerId: string, experienceId: string): LearningExperienceV1 {
  const row = db
    .select()
    .from(learningExperiences)
    .where(and(eq(learningExperiences.id, experienceId), eq(learningExperiences.learnerId, learnerId)))
    .get();
  if (!row) throw new NotFoundError('experience');
  return LearningExperienceV1Schema.parse(row.doc);
}

export function saveExperience(exp: LearningExperienceV1): void {
  db.insert(learningExperiences)
    .values({
      id: exp.id,
      lessonId: exp.lessonId,
      learnerId: exp.learnerId,
      courseId: exp.courseId,
      doc: exp,
      generatedAt: exp.generatedAt,
    })
    .run();
}

export function completedLessonIds(learnerId: string): Set<string> {
  const rows = db
    .select({ lessonId: lessonCompletions.lessonId })
    .from(lessonCompletions)
    .where(eq(lessonCompletions.learnerId, learnerId))
    .all();
  return new Set(rows.map((r) => r.lessonId));
}

export function hasCompletion(learnerId: string, lessonId: string): boolean {
  return !!db
    .select({ lessonId: lessonCompletions.lessonId })
    .from(lessonCompletions)
    .where(and(eq(lessonCompletions.learnerId, learnerId), eq(lessonCompletions.lessonId, lessonId)))
    .get();
}

export function saveCompletion(args: {
  learnerId: string;
  lessonId: string;
  lessonContentVersion: number;
  courseId: string;
  experienceId: string;
  completedAt: string;
}): void {
  db.insert(lessonCompletions).values(args).onConflictDoNothing().run();
}

export function appendEvent(event: HistoryEventV1): void {
  db.insert(historyEvents)
    .values({
      id: event.id,
      learnerId: event.learnerId,
      type: event.type,
      courseId: 'courseId' in event ? event.courseId : null,
      lessonId: 'lessonId' in event ? event.lessonId : null,
      at: event.at,
      doc: event,
    })
    .run();
}

export function eventsForExperience(learnerId: string, experienceId: string): HistoryEventV1[] {
  return db
    .select()
    .from(historyEvents)
    .where(eq(historyEvents.learnerId, learnerId))
    .orderBy(historyEvents.at)
    .all()
    .map((r) => r.doc)
    .filter((e) => 'experienceId' in e && e.experienceId === experienceId);
}

export function getStreak(learnerId: string): StreakV1 {
  const row = db.select().from(streaks).where(eq(streaks.learnerId, learnerId)).get();
  return StreakV1Schema.parse({ count: row?.count ?? 0, lastActiveDate: row?.lastActiveDate ?? null });
}

export function saveStreak(learnerId: string, streak: StreakV1): void {
  db.insert(streaks)
    .values({ learnerId, count: streak.count, lastActiveDate: streak.lastActiveDate })
    .onConflictDoUpdate({ target: streaks.learnerId, set: { count: streak.count, lastActiveDate: streak.lastActiveDate } })
    .run();
}
