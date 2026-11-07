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
