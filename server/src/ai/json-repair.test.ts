import { describe, expect, it } from 'vitest';
import { exampleSlides } from '../../../src/contracts/examples';
import { GeneratedSlidesV1Schema } from '../../../src/contracts';
import { parseWithCloserRepair } from './json-repair';

/**
 * A valid lesson document serialized the way the model returned it in the logs: one line, with the
 * multipleChoice options array last in its component, so a run of closers follows the last explanation.
 */
const lesson = {
  slides: exampleSlides.slides.map((slide) => ({
    ...slide,
    components: slide.components.map((c) => (c.type === 'multipleChoice' ? { id: c.id, type: c.type, prompt: c.prompt, correctOptionId: c.correctOptionId, options: c.options } : c)),
  })),
};
const valid = JSON.stringify(lesson);

/** The slip from the logs: the slide holding the multipleChoice closes with `extra` too many brackets. */
function withSlip(text: string, extra: string, from = 0): string {
  const marker = '}]}]}';
  // option } options ] component } components ] slide } — then "," and the next slide.
  const at = text.indexOf(marker + ',{"id"', text.indexOf('"multipleChoice"', from));
  expect(at).toBeGreaterThan(0);
  return text.slice(0, at + marker.length) + extra + text.slice(at + marker.length);
}

describe('parseWithCloserRepair', () => {
  it('returns valid JSON unchanged', () => {
    expect(parseWithCloserRepair(valid)).toEqual(lesson);
  });

  it('drops one stray closing brace after an options array (the common slip)', () => {
    const broken = withSlip(valid, '}');
    expect(() => JSON.parse(broken)).toThrow(/after array element/);
    const repaired = parseWithCloserRepair(broken);
    expect(repaired).toEqual(lesson);
    expect(GeneratedSlidesV1Schema.safeParse(repaired).success).toBe(true);
  });

  it('drops an extra "]}" that closed the whole document early', () => {
    const broken = withSlip(valid, ']}');
    expect(() => JSON.parse(broken)).toThrow(/non-whitespace character after JSON/);
    expect(parseWithCloserRepair(broken)).toEqual(lesson);
  });

  it('repairs the same slip on two slides', () => {
    const doubled = JSON.stringify({ slides: [...lesson.slides.slice(0, 2), { ...lesson.slides[1]!, id: 'check-2' }, ...lesson.slides.slice(2)] });
    const once = withSlip(doubled, '}');
    const twice = withSlip(once, '}', once.indexOf('"check-2"'));
    expect(() => JSON.parse(twice)).toThrow();
    expect(parseWithCloserRepair(twice)).toEqual(JSON.parse(doubled));
  });

  it('keeps indices right when the text has characters outside the BMP', () => {
    const emoji = JSON.stringify({ a: [{ b: '🍋 lime' }], c: 1 });
    const broken = emoji.replace('}],', '}]},');
    expect(parseWithCloserRepair(broken)).toEqual({ a: [{ b: '🍋 lime' }], c: 1 });
  });

  it('gives up (undefined) on damage it does not understand, never inventing content', () => {
    expect(parseWithCloserRepair('{"a": [1, 2')).toBeUndefined();
    expect(parseWithCloserRepair('not json at all')).toBeUndefined();
    expect(parseWithCloserRepair('{"a": "b" "c": 1}')).toBeUndefined();
  });
});
