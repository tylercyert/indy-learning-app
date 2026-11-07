import { describe, expect, it } from 'vitest';
import { edgeInset, fitLabel, labelWidth, nodeWidthFor, overlaps } from './diagram-layout';

describe('fitLabel', () => {
  it('keeps a short label on one line', () => {
    expect(fitLabel('stir', 84)).toEqual(['stir']);
  });
  it('splits an 18-char label into two lines when one line does not fit the phone label box', () => {
    // A 318px phone canvas allows a 106px label box; 18 chars ≈ 127px do not fit, the two halves do.
    const phoneBox = Math.min(120, Math.max(72, 318 / 3));
    expect(labelWidth('cuts sweetness fas')).toBeGreaterThan(phoneBox);
    expect(fitLabel('cuts sweetness fas', phoneBox)).toEqual(['cuts', 'sweetness fas']);
  });
  it('prefers the most even split', () => {
    expect(fitLabel('too much is flat', 70)).toEqual(['too much', 'is flat']);
  });
  it('returns null for a single word that cannot fit, so it goes to the legend', () => {
    expect(fitLabel('Supercalifragilist', 84)).toBeNull();
  });
  it('returns null when no split makes both halves fit', () => {
    expect(fitLabel('Supercalifragi x', 60)).toBeNull();
  });
});

describe('overlaps', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  it('detects touching within the margin', () => {
    expect(overlaps(a, { x: 12, y: 0, w: 10, h: 10 }, 4)).toBe(true);
    expect(overlaps(a, { x: 15, y: 0, w: 10, h: 10 }, 4)).toBe(false);
  });
});

describe('nodeWidthFor', () => {
  it('leaves at least the minimum gap between three phone columns', () => {
    const canvas = 318; // 390 phone − 20 padding × 2 − 16 card padding × 2
    const w = nodeWidthFor(canvas, 3, 8, 28);
    const gap = (canvas - 16 - w) / 2 - w;
    expect(gap).toBeGreaterThanOrEqual(28);
    expect(w).toBeGreaterThanOrEqual(72);
  });
  it('caps at 120 on wide canvases', () => {
    expect(nodeWidthFor(640, 2, 8, 28)).toBe(120);
  });
});

describe('edgeInset', () => {
  it('measures to the side for horizontal edges and to the top for vertical ones', () => {
    expect(edgeInset(100, 0, 120, 48)).toBe(64);
    expect(edgeInset(0, 100, 120, 48)).toBe(28);
  });
});
