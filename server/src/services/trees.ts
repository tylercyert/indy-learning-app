import { randomUUID } from 'node:crypto';
import { TreePlanV1Schema, ruleReferences, type CourseV1, type LearnerContextV1, type LessonV1, type NodeV1, type SkillTreeV1 } from '../../../src/contracts';
import { generateStructured, GenerationError } from '../ai/claude';
import { TREE_SYSTEM, treeUserMessage } from '../ai/prompts';
import { db } from '../db/client';
import { getOrGenerateExperience, prefetchAvailable } from './experiences';
import { buildLearningSummary } from './history';
import { prefixNodeIds } from './node-ids';
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
  // Never offer lessons the learner completed or that already sit in this course's trees.
  const inCourse = new Set(trees.flatMap((t) => t.nodes.map((n) => n.lessonId)));
  const reusable = repo
    .listLessonsBySubject(course.subject, 40)
    .filter((l) => !completed.has(l.id) && !inCourse.has(l.id))
    .map((l) => ({ id: l.id, title: l.title, objective: l.objective, difficulty: l.difficulty }));
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
  const sequence = (trees[trees.length - 1]?.sequence ?? -1) + 1;
  const newLessons: LessonV1[] = [];
  const usedLessonIds = new Set<string>();
  const rawNodes: NodeV1[] = plan.nodes.map((n) => {
    let lessonId: string;
    if (n.lesson.source === 'reuse' && !usedLessonIds.has(n.lesson.lessonId)) lessonId = n.lesson.lessonId;
    else {
      lessonId = randomUUID();
      newLessons.push({
        schemaVersion: 1,
        id: lessonId,
        title: n.title,
        objective: n.objective,
        subject: course.subject,
        tags: n.lesson.source === 'new' ? n.lesson.tags : [],
        difficulty: n.lesson.source === 'new' ? n.lesson.difficulty : 'core',
        estimatedMinutes: n.lesson.source === 'new' ? n.lesson.estimatedMinutes : 5,
        contentVersion: 1,
        createdAt: now,
      });
    }
    usedLessonIds.add(lessonId);
    return { id: n.id, lessonId, title: n.title, objective: n.objective, kind: n.kind, required: n.required, rule: normalizeRule(n.rule) };
  });
  // Node ids must be unique across the whole course, not just this tree.
  const nodes = prefixNodeIds(rawNodes, sequence);

  const tree: SkillTreeV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    courseId,
    title: plan.treeTitle,
    sequence,
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

  // Same rule as course creation: the learner should be able to start immediately, so the first
  // available required lesson of the new tree is written before we return.
  const completedNow = repo.completedLessonIds(learnerId);
  const first = tree.nodes.find((n) => n.required && !completedNow.has(n.lessonId) && ruleReferences(n.rule).length === 0);
  if (first) {
    await getOrGenerateExperience(learnerId, courseId, first.id).catch((e: unknown) => {
      console.warn(`[tree] first lesson not pre-written: ${e instanceof Error ? e.message : String(e)}`);
      prefetchAvailable(learnerId, courseId);
    });
  } else {
    prefetchAvailable(learnerId, courseId);
  }
  return tree;
}
