import { describe, expect, it } from 'vitest';
import type { NodeV1 } from '../../contracts';
import { BRANCH_RADIUS, layerNodes, layoutPath, MAIN_RADIUS, MAX_PER_ROW, rowsFor } from './path-layout';

const L = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const node = (id: string, required: boolean, allOf: string[] = [], kind: NodeV1['kind'] = required ? 'core' : 'optional'): NodeV1 => ({
  id,
  lessonId: L(1),
  title: id,
  objective: 'o',
  kind,
  required,
  rule: allOf.length ? { allOf } : {},
});

/** The real mixology shape: a fork into two required directions, a join, and an optional dead end. */
const tree: NodeV1[] = [
  node('orientation', true, [], 'orientation'),
  node('kit', true, ['orientation']),
  node('syrup', true, ['orientation']),
  node('sour', true, ['kit', 'syrup']),
  node('highball', true, ['kit']),
  node('fix-by-taste', false, ['sour']),
  node('party', true, ['sour', 'highball']),
];

describe('path layout', () => {
  it('layers nodes by longest prerequisite chain', () => {
    const layer = layerNodes(tree);
    expect(layer.get('orientation')).toBe(0);
    expect(layer.get('kit')).toBe(1);
    expect(layer.get('syrup')).toBe(1);
    expect(layer.get('sour')).toBe(2);
    expect(layer.get('highball')).toBe(2);
    expect(layer.get('fix-by-taste')).toBe(3);
    expect(layer.get('party')).toBe(3);
  });

  it('puts a fork side by side and the optional branch at the edge of its row', () => {
    const rows = rowsFor(tree);
    expect(rows.map((r) => r.map((n) => n.id))).toEqual([['orientation'], ['kit', 'syrup'], ['sour', 'highball'], ['party', 'fix-by-taste']]);
    const layout = layoutPath(tree, 350);
    const byId = new Map(layout.nodes.map((p) => [p.node.id, p]));
    const party = byId.get('party')!;
    const branch = byId.get('fix-by-taste')!;
    expect(party.row).toBe(branch.row);
    expect(party.r).toBe(MAIN_RADIUS);
    expect(branch.r).toBe(BRANCH_RADIUS);
    expect(branch.deadEnd).toBe(true);
    expect(party.deadEnd).toBe(true); // last node of the path
    expect(byId.get('sour')!.deadEnd).toBe(false);
    expect(party.labelMode).toBe('below');
    expect(byId.get('orientation')!.labelMode).toBe('side');
    // The branch and the main node never overlap horizontally.
    expect(Math.abs(party.cx - branch.cx)).toBeGreaterThan(party.r + branch.r + 24);
  });

  it('draws one connector per prerequisite and marks branches', () => {
    const { edges } = layoutPath(tree, 350);
    expect(edges).toContainEqual({ from: 'kit', to: 'sour', branch: false, long: false });
    expect(edges).toContainEqual({ from: 'syrup', to: 'sour', branch: false, long: false });
    expect(edges).toContainEqual({ from: 'sour', to: 'fix-by-taste', branch: true, long: false });
    expect(edges).toContainEqual({ from: 'kit', to: 'highball', branch: false, long: false });
    expect(edges.filter((e) => e.from === 'fix-by-taste')).toHaveLength(0);
  });

  it('hangs a branch on the same side as its anchor and centers a join', () => {
    const fork: NodeV1[] = [
      node('root', true, [], 'orientation'),
      node('left', true, ['root']),
      node('right', true, ['root']),
      node('join', true, ['left', 'right']),
      node('twist', false, ['right']),
    ];
    const byId = new Map(layoutPath(fork, 400).nodes.map((p) => [p.node.id, p]));
    expect(byId.get('left')!.cx).toBeLessThan(byId.get('right')!.cx);
    expect(byId.get('twist')!.cx).toBeGreaterThan(byId.get('join')!.cx); // branch hangs under "right"
    expect(byId.get('twist')!.row).toBe(byId.get('join')!.row);
  });

  it('keeps every circle inside the lane and never stacks more than three per row', () => {
    const wide: NodeV1[] = [node('root', true), ...[1, 2, 3, 4, 5].map((i) => node(`c${i}`, i % 2 === 1, ['root']))];
    const layout = layoutPath(wide, 350);
    for (const row of layout.rows) expect(row.length).toBeLessThanOrEqual(MAX_PER_ROW);
    expect(layout.rows).toHaveLength(3); // root, then 5 children over two rows
    for (const p of layout.nodes) {
      expect(p.cx - p.r).toBeGreaterThanOrEqual(0);
      expect(p.cx + p.r).toBeLessThanOrEqual(350);
    }
    expect(layout.height).toBeGreaterThan(layout.nodes[layout.nodes.length - 1]!.cy);
  });

  it('winds a plain chain left, center, right like the original path', () => {
    const chain: NodeV1[] = [node('a', true, [], 'orientation'), node('b', true, ['a']), node('c', true, ['b']), node('d', true, ['c'])];
    const xs = layoutPath(chain, 400).nodes.map((p) => p.cx);
    expect(xs[0]).toBe(200);
    expect(new Set(xs).size).toBeGreaterThan(1);
    expect(layoutPath(chain, 400).nodes.every((p) => p.labelMode === 'side')).toBe(true);
  });
});
