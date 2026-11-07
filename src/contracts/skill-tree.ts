import { z } from 'zod';
import { EntityIdSchema, LocalIdSchema, MediumTextSchema, ShortTextSchema, assertUniqueLocalIds } from './ids';

/**
 * ProgressionRuleV1: the condition that makes a node available.
 * Every present clause must hold. No clauses = root node.
 *   allOf:   every listed node completed
 *   anyOf:   at least one listed node completed
 *   atLeast: `count` of the listed nodes completed
 */
export const ProgressionRuleV1Schema = z
  .strictObject({
    allOf: z.array(LocalIdSchema).min(1).max(8).optional(),
    anyOf: z.array(LocalIdSchema).min(2).max(8).optional(),
    atLeast: z
      .strictObject({ count: z.int().min(1).max(8), of: z.array(LocalIdSchema).min(2).max(8) })
      .refine((v) => v.count <= v.of.length, { message: 'count cannot exceed the number of options' })
      .optional(),
  })
  .superRefine((rule, ctx) => {
    for (const key of ['allOf', 'anyOf'] as const) {
      const list = rule[key];
      if (list && new Set(list).size !== list.length) {
        ctx.addIssue({ code: 'custom', message: 'duplicate node id in rule', path: [key] });
      }
    }
  });
export type ProgressionRuleV1 = z.infer<typeof ProgressionRuleV1Schema>;

export const EMPTY_RULE: ProgressionRuleV1 = {};

export function ruleReferences(rule: ProgressionRuleV1): string[] {
  return [...(rule.allOf ?? []), ...(rule.anyOf ?? []), ...(rule.atLeast?.of ?? [])];
}

/** How a node is used in this tree. Display and planning only; progression comes from `rule`. */
export const NodeKindSchema = z.enum(['orientation', 'core', 'optional', 'exploration']);

/**
 * NodeV1: one lesson's placement in one skill tree.
 * The same lesson appears in other trees through other nodes.
 */
export const NodeV1Schema = z.strictObject({
  id: LocalIdSchema,
  lessonId: EntityIdSchema,
  title: ShortTextSchema.max(80),
  objective: MediumTextSchema,
  kind: NodeKindSchema,
  /** Required nodes gate course completion; optional ones never do. */
  required: z.boolean(),
  rule: ProgressionRuleV1Schema,
});
export type NodeV1 = z.infer<typeof NodeV1Schema>;

export function assertTreeShape(
  nodes: readonly { id: string; rule: ProgressionRuleV1; kind?: string }[],
  ctx: z.core.$RefinementCtx,
): void {
  assertUniqueLocalIds(nodes, ctx, 'node');
  const ids = new Set(nodes.map((n) => n.id));
  nodes.forEach((node, index) => {
    for (const ref of ruleReferences(node.rule)) {
      if (!ids.has(ref)) {
        ctx.addIssue({ code: 'custom', message: `rule references unknown node "${ref}"`, path: [index, 'rule'] });
      }
      if (ref === node.id) {
        ctx.addIssue({ code: 'custom', message: 'node cannot depend on itself', path: [index, 'rule'] });
      }
    }
  });
  if (!nodes.some((n) => ruleReferences(n.rule).length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'tree needs at least one root node (empty rule)' });
  }
  // Cycle check over the dependency graph (edges: ref -> node).
  const state = new Map<string, 'visiting' | 'done'>();
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 'done') return true;
    if (s === 'visiting') return false;
    state.set(id, 'visiting');
    const node = byId.get(id);
    for (const ref of node ? ruleReferences(node.rule) : []) {
      if (!visit(ref)) return false;
    }
    state.set(id, 'done');
    return true;
  };
  for (const node of nodes) {
    if (!visit(node.id)) {
      ctx.addIssue({ code: 'custom', message: 'progression rules form a cycle' });
      break;
    }
  }
  if (nodes.filter((n) => n.kind === 'orientation').length > 1) {
    ctx.addIssue({ code: 'custom', message: 'at most one orientation node per tree' });
  }
}

/**
 * SkillTreeV1: one structured learning path within a course. A course may hold several in sequence.
 * Holds no learner state: locked/available/completed is derived from lesson completions.
 */
export const SkillTreeV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: EntityIdSchema,
    courseId: EntityIdSchema,
    title: ShortTextSchema.max(80),
    /** 0 for the foundation tree, then 1, 2... as the course expands. */
    sequence: z.int().min(0),
    nodes: z.array(NodeV1Schema).min(1).max(30),
    createdAt: z.iso.datetime(),
  })
  .superRefine((tree, ctx) => assertTreeShape(tree.nodes, ctx));
export type SkillTreeV1 = z.infer<typeof SkillTreeV1Schema>;
