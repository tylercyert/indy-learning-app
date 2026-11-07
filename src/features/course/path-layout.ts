import { ruleReferences, type NodeV1 } from '../../contracts';

/**
 * Lays a skill tree out as a winding road: required lessons follow one path that swings
 * center → left → center → right, one per row, in dependency order. Optional lessons hang
 * off the lesson that unlocks them as smaller side branches, alternating left and right of
 * the road, and dead-end. Everything is derived from the nodes' rules; nothing is stored.
 */

export const MAIN_RADIUS = 38;
export const BRANCH_RADIUS = 30;
/** Row heights: a road step, and the shorter step a side branch adds after its anchor. */
export const ROW_SINGLE = 116;
export const ROW_BRANCH = 104;
const TOP_PAD = 10;
const BOTTOM_PAD = 20;

/** Road positions as fractions of the lane: center, left, center, right… */
const WIND = [0.5, 0.24, 0.5, 0.76];
/** Where a side branch sits, well clear of the road and of the next step's label. */
const BRANCH_LEFT = 0.16;
const BRANCH_RIGHT = 0.84;

export interface PlacedNode {
  node: NodeV1;
  row: number;
  cx: number;
  cy: number;
  r: number;
  /** Where the title goes: beside the circle (road) or under it (branch). */
  labelMode: 'side' | 'below';
  labelSide: 'left' | 'right';
  labelWidth: number;
  /** A lesson nothing else depends on: the end of a branch (or the end of the road). */
  deadEnd: boolean;
}

export interface PlacedEdge {
  from: string;
  to: string;
  /** Leads into an optional node: drawn as a teal side branch. */
  branch: boolean;
  /** Spans more than one row (never true for a winding road, kept for the renderer's API). */
  long: boolean;
}

export interface PathLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  height: number;
  rows: PlacedNode[][];
}

/** Longest-path layer of every node (0 for roots). Rules only reference known nodes (assertTreeShape). */
export function layerNodes(nodes: readonly NodeV1[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // cycles are rejected by the contract; stay total anyway
    visiting.add(id);
    const node = byId.get(id);
    const refs = node ? ruleReferences(node.rule).filter((r) => byId.has(r)) : [];
    const d = refs.length ? 1 + Math.max(...refs.map(depth)) : 0;
    visiting.delete(id);
    memo.set(id, d);
    return d;
  };
  for (const n of nodes) depth(n.id);
  return memo;
}

/** The road: required nodes in dependency order (by layer, then the tree's own order). */
export function roadOrder(nodes: readonly NodeV1[]): NodeV1[] {
  const layer = layerNodes(nodes);
  return nodes
    .map((node, i) => ({ node, i, l: layer.get(node.id) ?? 0 }))
    .filter((x) => x.node.required)
    .sort((a, b) => a.l - b.l || a.i - b.i)
    .map((x) => x.node);
}

/**
 * The road step an optional node hangs off: its latest prerequisite on the road (an optional
 * prerequisite is followed back to the road). Falls back to the first step.
 */
export function anchorOf(node: NodeV1, nodes: readonly NodeV1[], road: readonly NodeV1[]): NodeV1 | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = new Map(road.map((n, i) => [n.id, i]));
  const seen = new Set<string>();
  const resolve = (id: string): number => {
    if (seen.has(id)) return -1;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return -1;
    const own = index.get(id);
    if (own !== undefined) return own;
    return Math.max(-1, ...ruleReferences(n.rule).map(resolve));
  };
  const best = Math.max(-1, ...ruleReferences(node.rule).map(resolve));
  return best >= 0 ? road[best] : road[0];
}

export function layoutPath(nodes: readonly NodeV1[], laneWidth: number, offsetX = 0): PathLayout {
  const road = roadOrder(nodes);
  const optional = nodes.filter((n) => !n.required);
  const dependedOn = new Set(nodes.flatMap((n) => ruleReferences(n.rule)));
  const branchesByAnchor = new Map<string, NodeV1[]>();
  for (const o of optional) {
    const anchor = anchorOf(o, nodes, road);
    const key = anchor?.id ?? '';
    branchesByAnchor.set(key, [...(branchesByAnchor.get(key) ?? []), o]);
  }

  const placed: PlacedNode[] = [];
  const rows: PlacedNode[][] = [];
  const edges: PlacedEdge[] = [];
  let y = TOP_PAD;
  let row = 0;
  let branchSide: 'left' | 'right' = 'left';
  const sideLabelWidth = Math.min(190, laneWidth / 2 - MAIN_RADIUS - 24);

  const placeRoad = (node: NodeV1, i: number) => {
    const col = i === 0 ? 0.5 : WIND[i % WIND.length]!;
    const p: PlacedNode = {
      node,
      row,
      cx: offsetX + col * laneWidth,
      cy: y + MAIN_RADIUS,
      r: MAIN_RADIUS,
      labelMode: 'side',
      labelSide: col > 0.5 ? 'left' : 'right',
      labelWidth: sideLabelWidth,
      deadEnd: !dependedOn.has(node.id),
    };
    placed.push(p);
    rows.push([p]);
    row++;
    y += ROW_SINGLE;
    return col;
  };

  const placeBranch = (node: NodeV1, anchorId: string, nextCol: number | undefined) => {
    // Away from where the road goes next; alternate when the road stays centered.
    const side: 'left' | 'right' = nextCol === undefined || nextCol === 0.5 ? (branchSide = branchSide === 'left' ? 'right' : 'left') : nextCol < 0.5 ? 'right' : 'left';
    const col = side === 'left' ? BRANCH_LEFT : BRANCH_RIGHT;
    const p: PlacedNode = {
      node,
      row,
      cx: offsetX + col * laneWidth,
      cy: y + BRANCH_RADIUS,
      r: BRANCH_RADIUS,
      labelMode: 'below',
      labelSide: side,
      labelWidth: Math.min(150, laneWidth * 0.34),
      deadEnd: !dependedOn.has(node.id),
    };
    placed.push(p);
    rows.push([p]);
    edges.push({ from: anchorId, to: node.id, branch: true, long: false });
    row++;
    y += ROW_BRANCH;
  };

  if (road.length === 0 && optional.length > 0) {
    // Degenerate tree with no required lessons: show the optional ones as the road.
    optional.forEach((n, i) => placeRoad(n, i));
  } else {
    road.forEach((node, i) => {
      placeRoad(node, i);
      if (i > 0) edges.push({ from: road[i - 1]!.id, to: node.id, branch: false, long: false });
      const nextCol = i + 1 < road.length ? WIND[(i + 1) % WIND.length]! : undefined;
      for (const o of branchesByAnchor.get(node.id) ?? []) placeBranch(o, node.id, nextCol);
    });
    for (const o of branchesByAnchor.get('') ?? []) placeBranch(o, road[0]!.id, undefined);
  }

  return { nodes: placed, edges, height: y + BOTTOM_PAD, rows };
}
