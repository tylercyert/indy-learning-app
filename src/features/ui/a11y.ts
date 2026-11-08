/**
 * Pure accessibility rules shared by the components: keyboard semantics for radio groups and gap
 * fields, and WCAG contrast. No React Native imports, so they are unit-tested in Node.
 */

/** Space, as browsers report it (`' '`, and `'Spacebar'` in older engines). */
export function isSpaceKey(key: string): boolean {
  return key === ' ' || key === 'Spacebar';
}

/**
 * WAI-ARIA radio group: Down/Right move to the next radio and Up/Left to the previous one, wrapping
 * at the ends; the radio that receives focus is also selected. Returns the index to move to, or
 * null when the key is not a radio-group key (Tab, Enter and Space keep their own meaning).
 */
export function radioKeyTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (index - 1 + count) % count;
  return null;
}

/** The one radio in the tab order: the checked one, else the first (roving tabindex). */
export function radioTabStop(checkedIndex: number, count: number): number {
  return checkedIndex >= 0 && checkedIndex < count ? checkedIndex : 0;
}

/** Enter in a gap field: move on to the next gap, or check the answer from the last one. */
export function gapEnterAction(index: number, count: number): 'next' | 'check' {
  return index < count - 1 ? 'next' : 'check';
}

/**
 * The scale for a badge or box drawn around a glyph (option letter, match number, checkbox tick):
 * it follows the OS text size so the glyph keeps its margin at 200%, and never shrinks below 1x.
 */
export function glyphBoxSize(base: number, fontScale: number): number {
  return Math.round(base * Math.max(1, Number.isFinite(fontScale) ? fontScale : 1));
}

/** WCAG 2.x relative luminance of a #RRGGBB colour. */
export function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #RRGGBB colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
