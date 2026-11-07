import type { NodeV1, ProgressionRuleV1, SkillTreeV1 } from '../contracts';

export type NodeState = 'locked' | 'available' | 'completed';

/** A rule holds when every present clause holds. An empty rule always holds. */
export function isRuleSatisfied(rule: ProgressionRuleV1, completedNodeIds: ReadonlySet<string>): boolean {
  if (rule.allOf && !rule.allOf.every((id) => completedNodeIds.has(id))) return false;
  if (rule.anyOf && !rule.anyOf.some((id) => completedNodeIds.has(id))) return false;
  if (rule.atLeast) {
    const hits = rule.atLeast.of.filter((id) => completedNodeIds.has(id)).length;
    if (hits < rule.atLeast.count) return false;
  }
  return true;
}

/** Nodes are completed when their lesson is completed anywhere, for this learner. */
export function completedNodeIds(tree: SkillTreeV1, completedLessonIds: ReadonlySet<string>): Set<string> {
  return new Set(tree.nodes.filter((n) => completedLessonIds.has(n.lessonId)).map((n) => n.id));
}

export function deriveNodeStates(
  tree: SkillTreeV1,
  completedLessonIds: ReadonlySet<string>,
): Record<string, NodeState> {
  const done = completedNodeIds(tree, completedLessonIds);
  const states: Record<string, NodeState> = {};
  for (const node of tree.nodes) {
    states[node.id] = done.has(node.id) ? 'completed' : isRuleSatisfied(node.rule, done) ? 'available' : 'locked';
  }
  return states;
}

/** The single node the UI should point at: the first available node in tree order. */
export function nextNode(tree: SkillTreeV1, completedLessonIds: ReadonlySet<string>): NodeV1 | null {
  const states = deriveNodeStates(tree, completedLessonIds);
  return tree.nodes.find((n) => states[n.id] === 'available') ?? null;
}

/** A tree is complete when every required node is completed. Optional nodes never block. */
export function isTreeComplete(tree: SkillTreeV1, completedLessonIds: ReadonlySet<string>): boolean {
  const done = completedNodeIds(tree, completedLessonIds);
  return tree.nodes.filter((n) => n.required).every((n) => done.has(n.id));
}

export function treeProgress(
  tree: SkillTreeV1,
  completedLessonIds: ReadonlySet<string>,
): { completed: number; required: number; total: number } {
  const done = completedNodeIds(tree, completedLessonIds);
  const required = tree.nodes.filter((n) => n.required);
  return {
    completed: required.filter((n) => done.has(n.id)).length,
    required: required.length,
    total: tree.nodes.length,
  };
}
