import { randomUUID } from 'node:crypto';
import {
  GeneratedSlidesV1Schema,
  ruleReferences,
  type CourseV1,
  type LearningExperienceV1,
  type NodeV1,
  type SkillTreeV1,
} from '../../../src/contracts';
import { deriveNodeStates } from '../../../src/domain';
import { generateStructured } from '../ai/claude';
import { EXPERIENCE_SYSTEM, experienceUserMessage } from '../ai/prompts';
import { aiEnabled } from '../env';
import * as repo from './repo';

export class NodeLockedError extends Error {
  constructor(nodeId: string) {
    super(`node "${nodeId}" is locked`);
    this.name = 'NodeLockedError';
  }
}

/**
 * Generations in progress, keyed by learner:course:lesson. A learner who opens a node while its
 * lesson is being written joins the in-flight promise instead of starting a second generation.
 */
const inFlight = new Map<string, Promise<LearningExperienceV1>>();
const keyOf = (learnerId: string, courseId: string, lessonId: string) => `${learnerId}:${courseId}:${lessonId}`;

export function isGenerating(learnerId: string, courseId: string, lessonId: string): boolean {
  return inFlight.has(keyOf(learnerId, courseId, lessonId));
}

function findNode(trees: SkillTreeV1[], nodeId: string): { tree: SkillTreeV1; node: NodeV1 } {
  for (const tree of trees) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return { tree, node };
  }
  throw new repo.NotFoundError('node');
}

async function generate(learnerId: string, course: CourseV1, tree: SkillTreeV1, node: NodeV1, completed: Set<string>): Promise<LearningExperienceV1> {
  const lesson = repo.getLesson(node.lessonId);
  const refs = new Set(ruleReferences(node.rule));
  const before = tree.nodes.filter((n) => refs.has(n.id));
  const after = tree.nodes.filter((n) => ruleReferences(n.rule).includes(node.id));
  const completedTitles = tree.nodes.filter((n) => completed.has(n.lessonId)).map((n) => n.title);
  const upcomingTitles = tree.nodes.filter((n) => n.id !== node.id).map((n) => n.title);

  const { data, model } = await generateStructured({
    task: `experience:${lesson.title}`,
    schema: GeneratedSlidesV1Schema,
    system: EXPERIENCE_SYSTEM,
    messages: [{ role: 'user', content: experienceUserMessage({ course, lesson, node, before, after, completedTitles, upcomingTitles }) }],
    effort: 'medium',
    maxTokens: 24_000,
  });

  const experience: LearningExperienceV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    lessonId: lesson.id,
    lessonContentVersion: lesson.contentVersion,
    learnerId,
    courseId: course.id,
    slides: data.slides,
    generatedBy: model,
    generatedAt: new Date().toISOString(),
  };
  repo.saveExperience(experience);
  console.log(`[experience] ${experience.id} "${lesson.title}" ${experience.slides.length} slides by ${model}`);
  return experience;
}

function startOrJoin(learnerId: string, course: CourseV1, tree: SkillTreeV1, node: NodeV1, completed: Set<string>): Promise<LearningExperienceV1> {
  const key = keyOf(learnerId, course.id, node.lessonId);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = generate(learnerId, course, tree, node, completed).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * Returns the learner's experience for a node, generating it (or joining a generation already
 * running) on first open. Generation sees the course, the lesson objective, neighbors in the tree
 * and what the learner already completed; never the full history.
 */
export async function getOrGenerateExperience(learnerId: string, courseId: string, nodeId: string): Promise<LearningExperienceV1> {
  const course = repo.getCourse(learnerId, courseId);
  const trees = repo.getTrees(courseId);
  const { tree, node } = findNode(trees, nodeId);
  const completed = repo.completedLessonIds(learnerId);
  const state = deriveNodeStates(tree, completed)[node.id];
  if (state === 'locked') throw new NodeLockedError(node.id);

  const existing = repo.findExperience(learnerId, courseId, node.lessonId);
  if (existing) return existing;
  return startOrJoin(learnerId, course, tree, node, completed);
}

/**
 * Pre-generates lessons the learner is about to need: every available, required node in the
 * current tree that has no experience yet. Called after planning (the orientation lesson) and
 * after each completion (the newly unlocked lessons). Optional branches stay on demand.
 * Fire-and-forget: failures are logged and the on-demand path will retry when the node is opened.
 */
export function prefetchAvailable(learnerId: string, courseId: string, limit = 2): void {
  if (!aiEnabled) return;
  try {
    const course = repo.getCourse(learnerId, courseId);
    const trees = repo.getTrees(courseId);
    const tree = trees[trees.length - 1];
    if (!tree) return;
    const completed = repo.completedLessonIds(learnerId);
    const states = deriveNodeStates(tree, completed);
    const ready = repo.experienceLessonIds(learnerId, courseId);
    const candidates = tree.nodes.filter(
      (n) => states[n.id] === 'available' && (n.required || n.kind === 'orientation') && !ready.has(n.lessonId) && !isGenerating(learnerId, courseId, n.lessonId),
    );
    for (const node of candidates.slice(0, limit)) {
      console.log(`[prefetch] ${course.title} → "${node.title}"`);
      startOrJoin(learnerId, course, tree, node, completed).catch((e: unknown) => {
        console.warn(`[prefetch] "${node.title}" failed: ${e instanceof Error ? e.message : String(e)}`);
      });
    }
  } catch (e) {
    console.warn(`[prefetch] skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
}
