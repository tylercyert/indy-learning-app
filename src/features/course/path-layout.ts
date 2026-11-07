import { ruleReferences, type NodeV1 } from '../../contracts';

/**
 * Lays a skill tree out as a path that can fork and rejoin, the way the mockup draws it:
 * required nodes form the main path (two of them side by side when a node unlocks two
 * directions at once), optional nodes hang off their prerequisite as smaller side branches
 * that dead-end. Everything is derived from the nodes' progression rules; nothing is stored.
 *
 * Rows are longest-path layers (a node sits one row below the deepest prerequisite it
 * references). A row holds at most MAX_PER_ROW nodes; a fuller layer spills into extra rows.
 * Single-node rows wind left/center/right with the label beside the circle; shared rows put
 * labels under the circles so neither label collides with the other node.
 */

export const MAIN_RADIUS = 38;
export const BRANCH_RADIUS = 30;
export const MAX_PER_ROW = 3;
/** Row heights: a shared row needs room for labels under the circles. */
export const ROW_SINGLE = 116;
export const ROW_SHARED = 150;
const TOP_PAD = 10;
const BOTTOM_PAD = 20;

/** Horizontal positions as fractions of the lane, by nodes in the row. */
const WIND = [0.5, 0.24, 0.5, 0.76];
const COLS_BY_COUNT: Record<number, number[]> = { 1: [0.5], 2: [0.26, 0.74], 3: [0.18, 0.5, 0.82] };

export interface PlacedNode {
  node: NodeV1;
  row: number;
  cx: number;
  cy: number;
  r: number;
  /** Where the title goes: beside the circle (single-node rows) or under it (shared rows). */
  labelMode: 'side' | 'below';
  labelSide: 'left' | 'right';
  /** Horizontal room for a label under the circle. */
  labelWidth: number;
  /** A lesson nothing else depends on: the end of a branch. */
  deadEnd: boolean;
}

export interface PlacedEdge {
  from: string;
  to: string;
  /** Leads into an optional node: drawn as a side branch. */
  branch: boolean;
  /** Spans more than one row: drawn lighter so it does not compete with the adjacent steps. */
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

/**
 * Groups nodes into rows: by layer, in the tree's own order, required before optional so the
 * main path stays inside and branches sit at the edges; layers wider than MAX_PER_ROW spill.
 */
export function rowsFor(nodes: readonly NodeV1[]): NodeV1[][] {
  const layer = layerNodes(nodes);
  const maxLayer = Math.max(0, ...nodes.map((n) => layer.get(n.id) ?? 0));
  const rows: NodeV1[][] = [];
  for (let l = 0; l <= maxLayer; l++) {
    const inLayer = nodes.filter((n) => layer.get(n.id) === l);
    const ordered = [...inLayer.filter((n) => n.required), ...inLayer.filter((n) => !n.required)];
    for (let i = 0; i < ordered.length; i += MAX_PER_ROW) rows.push(ordered.slice(i, i + MAX_PER_ROW));
  }
  return rows;
}

/**
 * Orders a shared row by the barycenter of each node's prerequisites (the classic layered-graph
 * heuristic): a node sits under the things it depends on, so a branch hangs on its anchor's side
 * and connectors rarely cross. Ties keep the tree's own order (required before optional).
 */
function arrangeRow(row: NodeV1[], xOf: (id: string) => number | undefined): { node: NodeV1; col: number }[] {
  const cols = COLS_BY_COUNT[row.length] ?? COLS_BY_COUNT[MAX_PER_ROW]!;
  const bary = (n: NodeV1): number => {
    const xs = ruleReferences(n.rule).map(xOf).filter((x): x is number => x !== undefined);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
  };
  const sorted = row.map((node, i) => ({ node, i, b: bary(node) })).sort((p, q) => p.b - q.b || p.i - q.i);
  return sorted.map(({ node }, k) => ({ node, col: cols[k]! }));
}

/** A single node leans toward its prerequisites when they sit clearly to one side; otherwise the path winds. */
function singleCol(node: NodeV1, xOf: (id: string) => number | undefined, windIndex: number, isRoot: boolean): number {
  if (isRoot) return 0.5;
  const xs = ruleReferences(node.rule).map(xOf).filter((x): x is number => x !== undefined);
  const b = xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0.5;
  if (xs.length > 1) return 0.5; // a join sits between what it joins
  if (b <= 0.4) return WIND[1]!;
  if (b >= 0.6) return WIND[3]!;
  return WIND[windIndex % WIND.length]!;
}

export function layoutPath(nodes: readonly NodeV1[], laneWidth: number, offsetX = 0): PathLayout {
  const rows = rowsFor(nodes);
  const dependedOn = new Set(nodes.flatMap((n) => ruleReferences(n.rule)));
  const placed: PlacedNode[] = [];
  const placedRows: PlacedNode[][] = [];
  let y = TOP_PAD;
  const colOf = new Map<string, number>();
  let singleIndex = 0;
  for (const [rowIndex, row] of rows.entries()) {
    const shared = row.length > 1;
    const rowH = shared ? ROW_SHARED : ROW_SINGLE;
    const cy = y + MAIN_RADIUS;
    const xOf = (id: string) => colOf.get(id);
    const arranged = shared ? arrangeRow(row, xOf) : [{ node: row[0]!, col: singleCol(row[0]!, xOf, singleIndex++, rowIndex === 0) }];
    for (const a of arranged) colOf.set(a.node.id, a.col);
    const rowPlaced = arranged.map(({ node, col }) => ({
      node,
      row: rowIndex,
      cx: offsetX + col * laneWidth,
      cy,
      r: node.required ? MAIN_RADIUS : BRANCH_RADIUS,
      labelMode: shared ? ('below' as const) : ('side' as const),
      labelSide: col > 0.5 ? ('left' as const) : ('right' as const),
      labelWidth: shared ? Math.floor(laneWidth / row.length) - 16 : Math.min(190, laneWidth / 2 - MAIN_RADIUS - 24),
      deadEnd: !dependedOn.has(node.id),
    }));
    placed.push(...rowPlaced);
    placedRows.push(rowPlaced);
    y += rowH;
  }
  const rowOf = new Map(placed.map((p) => [p.node.id, p.row]));
  const edges: PlacedEdge[] = nodes.flatMap((n) =>
    ruleReferences(n.rule)
      .filter((from) => rowOf.has(from))
      .map((from) => ({ from, to: n.id, branch: !n.required, long: (rowOf.get(n.id) ?? 0) - (rowOf.get(from) ?? 0) > 1 })),
  );
  return { nodes: placed, edges, height: y - TOP_PAD + TOP_PAD + BOTTOM_PAD, rows: placedRows };
}
