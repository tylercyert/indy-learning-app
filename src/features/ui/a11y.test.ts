import { describe, expect, it } from 'vitest';
import { colors } from '../theme';
import { contrastRatio, gapEnterAction, glyphBoxSize, isSpaceKey, radioKeyTarget, radioTabStop } from './a11y';

describe('radio group keys', () => {
  it('moves forward with Down and Right, wrapping at the end', () => {
    expect(radioKeyTarget('ArrowDown', 0, 4)).toBe(1);
    expect(radioKeyTarget('ArrowRight', 2, 4)).toBe(3);
    expect(radioKeyTarget('ArrowDown', 3, 4)).toBe(0);
  });

  it('moves back with Up and Left, wrapping at the start', () => {
    expect(radioKeyTarget('ArrowUp', 2, 4)).toBe(1);
    expect(radioKeyTarget('ArrowLeft', 0, 4)).toBe(3);
  });

  it('leaves every other key alone', () => {
    for (const key of ['Tab', 'Enter', ' ', 'Home', 'End', 'a']) expect(radioKeyTarget(key, 1, 4)).toBeNull();
    expect(radioKeyTarget('ArrowDown', 0, 0)).toBeNull();
  });

  it('puts the checked radio in the tab order, else the first', () => {
    expect(radioTabStop(2, 4)).toBe(2);
    expect(radioTabStop(-1, 4)).toBe(0);
    expect(radioTabStop(7, 4)).toBe(0);
  });

  it('recognises Space in both spellings', () => {
    expect(isSpaceKey(' ')).toBe(true);
    expect(isSpaceKey('Spacebar')).toBe(true);
    expect(isSpaceKey('Enter')).toBe(false);
  });
});

describe('gap fields', () => {
  it('moves to the next gap on Enter and checks from the last one', () => {
    expect(gapEnterAction(0, 3)).toBe('next');
    expect(gapEnterAction(1, 3)).toBe('next');
    expect(gapEnterAction(2, 3)).toBe('check');
    expect(gapEnterAction(0, 1)).toBe('check');
  });
});

describe('glyph boxes follow the text size', () => {
  it('scales with the OS font scale and never shrinks below 1x', () => {
    expect(glyphBoxSize(30, 1)).toBe(30);
    expect(glyphBoxSize(30, 2)).toBe(60);
    expect(glyphBoxSize(26, 1.35)).toBe(35);
    expect(glyphBoxSize(30, 0.8)).toBe(30);
    expect(glyphBoxSize(30, Number.NaN)).toBe(30);
  });
});

describe('contrast', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('interactive control edges clear 3:1 (WCAG 1.4.11) where controls sit', () => {
    for (const bg of [colors.bg, colors.soft]) expect(contrastRatio(colors.control, bg)).toBeGreaterThanOrEqual(3);
  });

  it('the old edges did not, which is why controls no longer use them', () => {
    expect(contrastRatio(colors.line, colors.bg)).toBeLessThan(3);
    expect(contrastRatio('#C4B5FD', colors.bg)).toBeLessThan(3);
  });

  it('selected and checked states stay distinct from the resting edge', () => {
    expect(contrastRatio(colors.purple, colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.mintDeep, colors.bg)).toBeGreaterThanOrEqual(3);
  });
});
