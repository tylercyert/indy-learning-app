import { randomUUID } from 'node:crypto';
import { TreePlanV1Schema, type CourseV1, type LearnerContextV1, type LessonV1, type NodeV1, type SkillTreeV1 } from '../../../src/contracts';
import { generateStructured, GenerationError } from '../ai/claude';
import { TREE_SYSTEM, treeUserMessage } from '../ai/prompts';
import { db } from '../db/client';
import { prefetchAvailable } from './experiences';
import { buildLearningSummary } from './history';
import { normalizeRule } from './planning';
import * as repo from './repo';

/**
 * Adds a skill tree to an existing course: either the next stage after completion
 * ("keep going") or an exploration request ("I want to learn something different").
 * Prior trees and completions are untouched; the course reopens as active.
 */
export async function addSkillTree(
  learnerId: string,
  courseId: string,
  intent: { kind: 'continue' } | { kind: 'explore'; context: LearnerContextV1 },
): Promise<SkillTreeV1> {
  const course = repo.getCourse(learnerId, courseId);
  const trees = repo.getTrees(courseId);
  const completed = repo.completedLessonIds(learnerId);
  const summary = buildLearningSummary(learnerId, { subject: course.subject });
  const reusable = repo.listLessonsBySubject(course.subject, 40).map((l) => ({ id: l.id, title: l.title, objective: l.objective, difficulty: l.difficulty }));
  const reusableIds = new Set(reusable.map((l) => l.id));
  const priorTitles = trees.flatMap((t) => t.nodes.map((n) => `${n.title}${completed.has(n.lessonId) ? ' (completed)' : ''}`));

  const { data: plan, model } = await generateStructured({
    task: `tree-plan:${intent.kind}`,
    schema: TreePlanV1Schema,
    system: TREE_SYSTEM,
    messages: [{ role: 'user', content: treeUserMessage({ course, intent, priorTitles, reusable, summary }) }],
    effort: 'high',
    maxTokens: 12_000,
  });

  for (const node of plan.nodes) {
    if (node.lesson.source === 'reuse' && !reusableIds.has(node.lesson.lessonId)) {
      throw new GenerationError('invalid', `tree plan reused unknown lesson ${node.lesson.lessonId} on node ${node.id}`);
    }
  }

  const now = new Date().toISOString();
  const newLessons: LessonV1[] = [];
  const nodes: NodeV1[] = plan.nodes.map((n) => {
    let lessonId: string;
    if (n.lesson.source === 'reuse') lessonId = n.lesson.lessonId;
    else {
      lessonId = randomUUID();
      newLessons.push({
        schemaVersion: 1,
        id: lessonId,
        title: n.title,
        objective: n.objective,
        subject: course.subject,
        tags: n.lesson.tags,
        difficulty: n.lesson.difficulty,
        estimatedMinutes: n.lesson.estimatedMinutes,
        contentVersion: 1,
        createdAt: now,
      });
    }
    return { id: n.id, lessonId, title: n.title, objective: n.objective, kind: n.kind, required: n.required, rule: normalizeRule(n.rule) };
  });

  const tree: SkillTreeV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    courseId,
    title: plan.treeTitle,
    sequence: (trees[trees.length - 1]?.sequence ?? -1) + 1,
    nodes,
    createdAt: now,
  };

  const reopened: CourseV1 = {
    ...course,
    status: 'active',
    // An exploration folds the learner's new direction into the course context.
    context: intent.kind === 'explore' ? intent.context : course.context,
    updatedAt: now,
  };

  db.transaction(() => {
    for (const lesson of newLessons) repo.saveLesson(lesson);
    repo.saveTree(tree);
    repo.saveCourse(reopened);
  });
  console.log(`[tree] course ${courseId} +tree ${tree.sequence} "${tree.title}" ${nodes.length} nodes (${newLessons.length} new) by ${model}`);
  prefetchAvailable(learnerId, courseId);
  return tree;
}
