/**
 * Pure geometry for the Diagram renderer. No React Native imports, so it is unit-testable in node.
 */

export const LABEL_FONT = 11;
export const LABEL_LINE_H = 16;
/** Average advance of the label font at LABEL_FONT. */
export const LABEL_CHAR_W = 6.4;
/** Horizontal padding around a label. */
export const LABEL_PAD = 12;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return a.x < b.x + b.w + margin && a.x + a.w > b.x - margin && a.y < b.y + b.h + margin && a.y + a.h > b.y - margin;
}

/** Estimated rendered width of one label line. */
export function labelWidth(line: string): number {
  return Math.ceil(line.length * LABEL_CHAR_W + LABEL_PAD);
}

/**
 * One line when the label fits, two lines when it can be split at a space into halves that both
 * fit (preferring the most even split), otherwise null: the caller sends it to the legend.
 */
export function fitLabel(label: string, maxW: number): string[] | null {
  const fits = (s: string) => labelWidth(s) <= maxW;
  if (fits(label)) return [label];
  const words = label.split(' ');
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  for (let i = 1; i < words.length; i++) {
    const head = words.slice(0, i).join(' ');
    const tail = words.slice(i).join(' ');
    if (!fits(head) || !fits(tail)) continue;
    if (!best || Math.abs(head.length - tail.length) < Math.abs(best[0].length - best[1].length)) best = [head, tail];
  }
  return best;
}

/** Distance from a box center to its border along a direction, plus a small gap. */
export function edgeInset(dx: number, dy: number, w: number, h: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const ux = Math.abs(dx / len);
  const uy = Math.abs(dy / len);
  const tx = ux > 0 ? w / 2 / ux : Infinity;
  const ty = uy > 0 ? h / 2 / uy : Infinity;
  return Math.min(tx, ty) + 4;
}

/**
 * Node width for a canvas: as wide as 120 allows, never narrower than 72, and never so wide that
 * two columns sit closer than `minGap` (a horizontal edge must keep a visible shaft).
 */
export function nodeWidthFor(canvasWidth: number, cols: number, pad: number, minGap: number): number {
  return Math.max(72, Math.min(120, (canvasWidth - pad * 2 - minGap * (cols - 1)) / cols));
}

/** Average advance of the node font (Nunito Black at 12 px), slightly generous so estimates never under-size. */
export const NODE_CHAR_W = 6.8;
/** Horizontal padding inside a node plus a little slack. */
export const NODE_PAD = 16;
export const NODE_MIN_W = 64;
export const NODE_MAX_W = 140;
/** Never narrower than this, even when a word must break: a node still has to hold a few letters. */
const NODE_FLOOR_W = 48;

const clampW = (w: number) => Math.min(NODE_MAX_W, Math.max(NODE_MIN_W, Math.ceil(w)));

/**
 * What one node label asks for (#20, node width from text): `want` puts the label on one line when
 * that fits the maximum; `hard` keeps its longest word whole, the narrowest it can go without
 * breaking a word.
 */
export function labelNodeWidths(label: string): { want: number; hard: number } {
  const words = label.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => w.length));
  return { want: clampW(label.length * NODE_CHAR_W + NODE_PAD), hard: clampW(longest * NODE_CHAR_W + NODE_PAD) };
}

/**
 * Column widths for a diagram canvas, from the labels in each column. Every column gets what its
 * labels want when that fits with at least `minGap` between columns. Otherwise the widest columns
 * give way first, down to keeping their longest word whole; only when even that cannot fit do all
 * columns shrink proportionally (and a long word may break).
 */
export function columnWidths(labelsByColumn: readonly (readonly string[])[], canvasWidth: number, pad: number, minGap: number): number[] {
  const cols = labelsByColumn.length;
  if (cols === 0) return [];
  const asks = labelsByColumn.map((labels) => {
    const each = labels.map(labelNodeWidths);
    return { want: Math.max(NODE_MIN_W, ...each.map((e) => e.want)), hard: Math.max(NODE_MIN_W, ...each.map((e) => e.hard)) };
  });
  const avail = canvasWidth - pad * 2 - minGap * (cols - 1);
  const total = (ws: number[]) => ws.reduce((a, b) => a + b, 0);
  const want = asks.map((a) => a.want);
  if (total(want) <= avail) return want;
  const hard = asks.map((a) => a.hard);
  if (total(hard) > avail) {
    const scale = avail / total(hard);
    return hard.map((h) => Math.max(NODE_FLOOR_W, Math.floor(h * scale)));
  }
  // Water-fill: find the largest cap c with sum(max(hard, min(want, c))) <= avail.
  let lo = 0;
  let hi = NODE_MAX_W;
  for (let i = 0; i < 24; i++) {
    const c = (lo + hi) / 2;
    if (total(asks.map((a) => Math.max(a.hard, Math.min(a.want, c)))) <= avail) lo = c;
    else hi = c;
  }
  return asks.map((a) => Math.floor(Math.max(a.hard, Math.min(a.want, lo))));
}
