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
import { buildLearningSummary, describeSummary } from './history';
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

/**
 * Resolves a node. With a treeId the lookup is exact; without one, the newest tree wins so a
 * node id reused by an older tree can never redirect a tap to the wrong lesson.
 */
function findNode(trees: SkillTreeV1[], nodeId: string, treeId?: string): { tree: SkillTreeV1; node: NodeV1 } {
  const candidates = treeId ? trees.filter((t) => t.id === treeId) : [...trees].reverse();
  for (const tree of candidates) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return { tree, node };
  }
  throw new repo.NotFoundError('node');
}

/**
 * An experience may exist before its node is reachable (prefetch). Serving it would bypass the
 * tree, so every read of an experience checks that its lesson is available or completed in the
 * course for this learner.
 */
export function assertExperienceOpenable(learnerId: string, exp: LearningExperienceV1): void {
  const trees = repo.getTrees(exp.courseId);
  const completed = repo.completedLessonIds(learnerId);
  if (completed.has(exp.lessonId)) return;
  for (const tree of trees) {
    const states = deriveNodeStates(tree, completed);
    if (tree.nodes.some((n) => n.lessonId === exp.lessonId && states[n.id] !== 'locked')) return;
  }
  console.warn(`[lock] refused experience ${exp.id} (lesson ${exp.lessonId}) for learner ${learnerId}: still locked`);
  throw new NodeLockedError(exp.lessonId);
}

async function generate(learnerId: string, course: CourseV1, tree: SkillTreeV1, node: NodeV1, completed: Set<string>): Promise<LearningExperienceV1> {
  const lesson = repo.getLesson(node.lessonId);
  const refs = new Set(ruleReferences(node.rule));
  const before = tree.nodes.filter((n) => refs.has(n.id));
  const after = tree.nodes.filter((n) => ruleReferences(n.rule).includes(node.id));
  const completedTitles = tree.nodes.filter((n) => completed.has(n.lessonId)).map((n) => n.title);
  const upcomingTitles = tree.nodes.filter((n) => n.id !== node.id).map((n) => n.title);
  const history = describeSummary(buildLearningSummary(learnerId));

  const { data, model } = await generateStructured({
    task: `experience:${lesson.title}`,
    schema: GeneratedSlidesV1Schema,
    system: EXPERIENCE_SYSTEM,
    messages: [{ role: 'user', content: experienceUserMessage({ course, lesson, node, before, after, completedTitles, upcomingTitles, history }) }],
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
export async function getOrGenerateExperience(learnerId: string, courseId: string, nodeId: string, treeId?: string): Promise<LearningExperienceV1> {
  const course = repo.getCourse(learnerId, courseId);
  const trees = repo.getTrees(courseId);
  const { tree, node } = findNode(trees, nodeId, treeId);
  const completed = repo.completedLessonIds(learnerId);
  const state = deriveNodeStates(tree, completed)[node.id];
  if (state === 'locked') throw new NodeLockedError(node.id);

  // While the learner works through this lesson, write the lessons it will unlock.
  prefetchUpcoming(learnerId, courseId, node.id, tree.id);

  const existing = repo.findExperience(learnerId, courseId, node.lessonId);
  if (existing) return existing;
  return startOrJoin(learnerId, course, tree, node, completed);
}

/**
 * Predictive prefetch: assume the node being opened will be completed, derive which required
 * nodes that would make available, and start generating those now. By the time the learner
 * finishes, the next lesson is ready. Bounded, fire-and-forget, deduplicated with in-flight work.
 */
export function prefetchUpcoming(learnerId: string, courseId: string, openedNodeId: string, treeId?: string, limit = 2): void {
  if (!aiEnabled) return;
  try {
    const course = repo.getCourse(learnerId, courseId);
    const trees = repo.getTrees(courseId);
    const { tree, node } = findNode(trees, openedNodeId, treeId);
    const completed = repo.completedLessonIds(learnerId);
    const assumed = new Set([...completed, node.lessonId]);
    const before = deriveNodeStates(tree, completed);
    const afterStates = deriveNodeStates(tree, assumed);
    const ready = repo.experienceLessonIds(learnerId, courseId);
    const unlocking = tree.nodes.filter(
      (n) =>
        n.id !== node.id &&
        afterStates[n.id] === 'available' &&
        before[n.id] !== 'completed' &&
        n.required &&
        !ready.has(n.lessonId) &&
        !isGenerating(learnerId, courseId, n.lessonId),
    );
    for (const next of unlocking.slice(0, limit)) {
      console.log(`[prefetch:upcoming] ${course.title}: "${node.title}" → "${next.title}"`);
      startOrJoin(learnerId, course, tree, next, assumed).catch((e: unknown) => {
        console.warn(`[prefetch:upcoming] "${next.title}" failed: ${e instanceof Error ? e.message : String(e)}`);
      });
    }
  } catch (e) {
    console.warn(`[prefetch:upcoming] skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
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
