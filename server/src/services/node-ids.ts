import type { NodeV1 } from '../../../src/contracts';

/**
 * Node ids come from the model and are unique only within one tree. A course holds several trees,
 * so added trees get a per-tree prefix on every node id and every rule reference. The first tree
 * (sequence 0) keeps bare ids for compatibility with existing data.
 */
export function prefixNodeIds(nodes: NodeV1[], sequence: number): NodeV1[] {
  if (sequence === 0) return nodes;
  const prefix = `t${sequence}-`;
  const map = (id: string) => `${prefix}${id}`;
  return nodes.map((n) => ({
    ...n,
    id: map(n.id),
    rule: {
      ...(n.rule.allOf && n.rule.allOf.length ? { allOf: n.rule.allOf.map(map) } : {}),
      ...(n.rule.anyOf && n.rule.anyOf.length ? { anyOf: n.rule.anyOf.map(map) } : {}),
      ...(n.rule.atLeast ? { atLeast: { count: n.rule.atLeast.count, of: n.rule.atLeast.of.map(map) } } : {}),
    },
  }));
}
