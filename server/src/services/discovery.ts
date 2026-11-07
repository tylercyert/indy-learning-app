import { randomUUID } from 'node:crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { CourseV1, DiscoverableCourse, LearnerContextV1, SkillTreeV1 } from '../../../src/contracts';
import { db } from '../db/client';
import { courses } from '../db/schema';
import { prefetchAvailable } from './experiences';
import * as repo from './repo';

/**
 * Course discovery shares STRUCTURE, never a learner's context. The listing is a public
 * projection; starting from a discovered course clones its skill trees (same lesson ids,
 * so completions are recognized) under the new learner with a fresh, minimal context.
 */
export function listDiscoverable(learnerId: string, limit = 20): DiscoverableCourse[] {
  const rows = db
    .select()
    .from(courses)
    .where(and(eq(courses.discoverable, true), ne(courses.learnerId, learnerId)))
    .orderBy(desc(courses.createdAt))
    .limit(limit * 3)
    .all();
  const seen = new Set<string>();
  const out: DiscoverableCourse[] = [];
  for (const row of rows) {
    const course = row.doc as CourseV1;
    // One card per distinct title+subject so clones do not flood the list.
    const key = `${course.subject}:${course.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const trees = repo.getTrees(course.id);
    const first = trees[0];
    if (!first) continue;
    out.push({
      courseId: course.id,
      title: course.title,
      subject: course.subject,
      summary: course.summary,
      companion: course.companion,
      lessonCount: trees.reduce((n, t) => n + t.nodes.length, 0),
      firstLessons: first.nodes.slice(0, 4).map((n) => n.title),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function startFromDiscovered(learnerId: string, sourceCourseId: string, goalStatement?: string): CourseV1 {
  const source = repo.getCourseAnyOwner(sourceCourseId);
  if (!source.discoverable) throw new repo.NotFoundError('discoverable course');
  const sourceTrees = repo.getTrees(sourceCourseId);
  const now = new Date().toISOString();
  const courseId = randomUUID();

  // Minimal, honest context: the learner picked a shared course; we know the goal, not their history.
  const context: LearnerContextV1 = {
    schemaVersion: 1,
    goal: {
      topic: source.subject,
      statement: goalStatement?.trim() || `Learn ${source.title}`,
      outcome: source.summary,
      application: null,
    },
    experience: { level: 'new', notes: null },
    horizon: 'steady',
    facts: [],
    constraints: [],
  };

  const course: CourseV1 = {
    schemaVersion: 1,
    id: courseId,
    learnerId,
    title: source.title,
    subject: source.subject,
    summary: source.summary,
    context,
    companion: source.companion,
    status: 'active',
    discoverable: false,
    sourceCourseId: source.id,
    createdAt: now,
    updatedAt: now,
  };
  const trees: SkillTreeV1[] = sourceTrees.map((t) => ({ ...t, id: randomUUID(), courseId, createdAt: now }));

  db.transaction(() => {
    repo.saveCourse(course);
    for (const tree of trees) repo.saveTree(tree);
  });
  prefetchAvailable(learnerId, courseId);
  return course;
}
