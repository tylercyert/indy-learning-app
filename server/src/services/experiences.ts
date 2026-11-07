import { randomUUID } from 'node:crypto';
import { GeneratedSlidesV1Schema, type LearningExperienceV1, type NodeV1, type SkillTreeV1 } from '../../../src/contracts';
import { deriveNodeStates } from '../../../src/domain';
import { generateStructured } from '../ai/claude';
import { EXPERIENCE_SYSTEM, experienceUserMessage } from '../ai/prompts';
import * as repo from './repo';

export class NodeLockedError extends Error {
  constructor(nodeId: string) {
    super(`node "${nodeId}" is locked`);
    this.name = 'NodeLockedError';
  }
}

function findNode(trees: SkillTreeV1[], nodeId: string): { tree: SkillTreeV1; node: NodeV1 } {
  for (const tree of trees) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return { tree, node };
  }
  throw new repo.NotFoundError('node');
}

/**
 * Returns the learner's experience for a node, generating it on first open.
 * Generation sees the course, the lesson objective, neighbors in the tree and
 * what the learner already completed; never the full history.
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

  const lesson = repo.getLesson(node.lessonId);
  const refs = new Set([...(node.rule.allOf ?? []), ...(node.rule.anyOf ?? []), ...(node.rule.atLeast?.of ?? [])]);
  const before = tree.nodes.filter((n) => refs.has(n.id));
  const after = tree.nodes.filter((n) =>
    [...(n.rule.allOf ?? []), ...(n.rule.anyOf ?? []), ...(n.rule.atLeast?.of ?? [])].includes(node.id),
  );
  const completedTitles = tree.nodes.filter((n) => completed.has(n.lessonId)).map((n) => n.title);

  const { data, model } = await generateStructured({
    task: `experience:${lesson.title}`,
    schema: GeneratedSlidesV1Schema,
    system: EXPERIENCE_SYSTEM,
    messages: [{ role: 'user', content: experienceUserMessage({ course, lesson, node, before, after, completedTitles }) }],
    effort: 'medium',
    maxTokens: 24_000,
  });

  const experience: LearningExperienceV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    lessonId: lesson.id,
    lessonContentVersion: lesson.contentVersion,
    learnerId,
    courseId,
    slides: data.slides,
    generatedBy: model,
    generatedAt: new Date().toISOString(),
  };
  repo.saveExperience(experience);
  console.log(`[experience] ${experience.id} "${lesson.title}" ${experience.slides.length} slides by ${model}`);
  return experience;
}
