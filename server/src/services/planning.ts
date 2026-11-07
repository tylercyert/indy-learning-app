import { randomUUID } from 'node:crypto';
import {
  BASE_COMPANION,
  CompanionThemeV1Schema,
  CoursePlanV1Schema,
  activeClauses,
  type CourseV1,
  type LearnerContextV1,
  type LessonV1,
  type NodeV1,
  type ProgressionRuleV1,
  type SkillTreeV1,
} from '../../../src/contracts';
import { generateStructured, GenerationError } from '../ai/claude';
import { PLANNING_SYSTEM, planningUserMessage } from '../ai/prompts';
import { db } from '../db/client';
import { getOrGenerateExperience, prefetchAvailable } from './experiences';
import { buildLearningSummary, describeSummary } from './history';
import * as repo from './repo';
import { markPlanned, readyContext } from './intake';

/** Drops null, undefined and empty clauses so stored rules only carry what they mean. */
export function normalizeRule(rule: ProgressionRuleV1): ProgressionRuleV1 {
  return activeClauses(rule);
}

/**
 * Turns a ready intake into a course: plan with the model, then materialize
 * course + lessons + skill tree in one transaction. Nothing is generated for
 * individual lessons here; experiences are produced on demand.
 */
export async function createCourseFromIntake(learnerId: string, intakeId: string): Promise<CourseV1> {
  const { row, context } = readyContext(learnerId, intakeId);
  const reusable = repo.listLessonsBySubject(context.goal.topic).map((l) => ({
    id: l.id,
    title: l.title,
    objective: l.objective,
    difficulty: l.difficulty,
  }));
  const reusableIds = new Set(reusable.map((l) => l.id));

  const history = describeSummary(buildLearningSummary(learnerId));
  const { data: plan, model } = await generateStructured({
    task: 'course-plan',
    schema: CoursePlanV1Schema,
    system: PLANNING_SYSTEM,
    messages: [{ role: 'user', content: planningUserMessage(context, reusable, history) }],
    effort: 'high',
    maxTokens: 16_000,
  });

  // A reuse reference must point at a lesson we actually offered.
  for (const node of plan.nodes) {
    if (node.lesson.source === 'reuse' && !reusableIds.has(node.lesson.lessonId)) {
      throw new GenerationError('invalid', `plan reused unknown lesson ${node.lesson.lessonId} on node ${node.id}`);
    }
  }

  const now = new Date().toISOString();
  const courseId = randomUUID();
  const companion = CompanionThemeV1Schema.safeParse(plan.companion).success ? plan.companion : BASE_COMPANION;

  const newLessons: LessonV1[] = [];
  const nodes: NodeV1[] = plan.nodes.map((n) => {
    let lessonId: string;
    if (n.lesson.source === 'reuse') {
      lessonId = n.lesson.lessonId;
    } else {
      lessonId = randomUUID();
      newLessons.push({
        schemaVersion: 1,
        id: lessonId,
        title: n.title,
        objective: n.objective,
        subject: plan.subject,
        tags: n.lesson.tags,
        difficulty: n.lesson.difficulty,
        estimatedMinutes: n.lesson.estimatedMinutes,
        contentVersion: 1,
        createdAt: now,
      });
    }
    return { id: n.id, lessonId, title: n.title, objective: n.objective, kind: n.kind, required: n.required, rule: normalizeRule(n.rule) };
  });

  const course: CourseV1 = {
    schemaVersion: 1,
    id: courseId,
    learnerId,
    title: plan.title,
    subject: plan.subject,
    summary: plan.summary,
    context: context satisfies LearnerContextV1,
    companion,
    status: 'active',
    discoverable: true,
    sourceCourseId: null,
    createdAt: now,
    updatedAt: now,
  };

  const tree: SkillTreeV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    courseId,
    title: plan.treeTitle,
    sequence: 0,
    nodes,
    createdAt: now,
  };

  db.transaction(() => {
    for (const lesson of newLessons) repo.saveLesson(lesson);
    repo.saveCourse(course);
    repo.saveTree(tree);
    markPlanned(row.id);
  });

  console.log(`[plan] course ${courseId} "${course.title}" ${nodes.length} nodes (${newLessons.length} new) by ${model}`);

  // The learner should land on a course whose first lesson is already written: wait for the
  // orientation experience here (one longer wait under the planning screen instead of two).
  // Opening it later also pre-writes the lessons it unlocks. If generation fails, the course
  // still exists and the node falls back to on-demand generation.
  const orientation = nodes.find((n) => n.kind === 'orientation');
  if (orientation) {
    await getOrGenerateExperience(learnerId, courseId, orientation.id).catch((e: unknown) => {
      console.warn(`[plan] orientation lesson not pre-written: ${e instanceof Error ? e.message : String(e)}`);
      prefetchAvailable(learnerId, courseId);
    });
  } else {
    prefetchAvailable(learnerId, courseId);
  }
  return course;
}
