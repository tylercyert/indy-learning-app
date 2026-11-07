import { describe, expect, it } from 'vitest';
import type { NodeV1 } from '../../contracts';
import { anchorOf, BRANCH_RADIUS, layerNodes, layoutPath, MAIN_RADIUS, roadOrder } from './path-layout';

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

describe('path layout (winding road with side branches)', () => {
  it('layers nodes by longest prerequisite chain', () => {
    const layer = layerNodes(tree);
    expect(layer.get('orientation')).toBe(0);
    expect(layer.get('kit')).toBe(1);
    expect(layer.get('sour')).toBe(2);
    expect(layer.get('party')).toBe(3);
  });

  it('orders the road by dependency, keeping the tree order inside a layer', () => {
    expect(roadOrder(tree).map((n) => n.id)).toEqual(['orientation', 'kit', 'syrup', 'sour', 'highball', 'party']);
  });

  it('winds the road center, left, center, right and connects consecutive steps', () => {
    const layout = layoutPath(tree, 400);
    const road = layout.nodes.filter((p) => p.node.required);
    expect(road.map((p) => p.cx)).toEqual([200, 96, 200, 304, 200, 96]);
    expect(road.every((p) => p.labelMode === 'side' && p.r === MAIN_RADIUS)).toBe(true);
    const roadEdges = layout.edges.filter((e) => !e.branch);
    expect(roadEdges.map((e) => `${e.from}>${e.to}`)).toEqual(['orientation>kit', 'kit>syrup', 'syrup>sour', 'sour>highball', 'highball>party']);
    // Rows are strictly increasing down the page.
    const ys = layout.nodes.map((p) => p.cy);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('hangs an optional lesson off its anchor as a smaller side branch, away from the next step', () => {
    const layout = layoutPath(tree, 400);
    const byId = new Map(layout.nodes.map((p) => [p.node.id, p]));
    const branch = byId.get('fix-by-taste')!;
    const sour = byId.get('sour')!;
    const highball = byId.get('highball')!;
    expect(anchorOf(tree[5]!, tree, roadOrder(tree))?.id).toBe('sour');
    expect(branch.r).toBe(BRANCH_RADIUS);
    expect(branch.labelMode).toBe('below');
    expect(branch.deadEnd).toBe(true);
    expect(branch.cy).toBeGreaterThan(sour.cy);
    expect(branch.cy).toBeLessThan(highball.cy);
    // A branch sits well outside the road, at one of the two side columns.
    expect(Math.min(branch.cx, 400 - branch.cx)).toBeLessThanOrEqual(0.16 * 400 + 1);
    expect(layout.edges).toContainEqual({ from: 'sour', to: 'fix-by-taste', branch: true, long: false });
    expect(layout.edges.filter((e) => e.from === 'fix-by-taste')).toHaveLength(0);
  });

  it('alternates branch sides when the road stays centered and follows optional chains back to the road', () => {
    const t: NodeV1[] = [
      node('a', true, [], 'orientation'),
      node('x', false, ['a']),
      node('y', false, ['a']),
      node('z', false, ['y']), // optional off an optional: anchors to the road step "a"
    ];
    const layout = layoutPath(t, 400);
    const byId = new Map(layout.nodes.map((p) => [p.node.id, p]));
    expect(byId.get('x')!.cx).not.toBe(byId.get('y')!.cx);
    expect(anchorOf(t[3]!, t, roadOrder(t))?.id).toBe('a');
    expect(layout.edges.filter((e) => e.branch)).toHaveLength(3);
    expect(layout.height).toBeGreaterThan(byId.get('z')!.cy + BRANCH_RADIUS);
  });

  it('keeps every circle inside the lane', () => {
    const wide: NodeV1[] = [node('root', true), ...[1, 2, 3, 4, 5].map((i) => node(`c${i}`, i % 2 === 1, ['root']))];
    for (const p of layoutPath(wide, 350).nodes) {
      expect(p.cx - p.r).toBeGreaterThanOrEqual(0);
      expect(p.cx + p.r).toBeLessThanOrEqual(350);
    }
  });
});
