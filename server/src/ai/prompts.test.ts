import { describe, expect, it } from 'vitest';
import { orientationBrief } from './prompts';

describe('orientationBrief (#21, #20)', () => {
  const titles = (n: number) => Array.from({ length: n }, (_, i) => `Lesson ${i + 1}`);

  it('states the orientation limits as an override', () => {
    const brief = orientationBrief(titles(3));
    expect(brief).toContain('OVERRIDES');
    expect(brief).toContain('3 to 5 slides');
    expect(brief).toContain('at most 1 slide with purpose teach or practice');
  });

  it('lists every title when the path is short', () => {
    const brief = orientationBrief(titles(6));
    for (const t of titles(6)) expect(brief).toContain(`"${t}"`);
    expect(brief).not.toContain('more"');
  });

  it('lists five titles and says exactly how many more follow', () => {
    const brief = orientationBrief(titles(11));
    expect(brief).toContain('"Lesson 5"');
    expect(brief).not.toContain('"Lesson 6"');
    expect(brief).toContain('"and 6 more"');
  });

  it('omits the preview when nothing follows', () => {
    expect(orientationBrief([])).not.toContain('Preview');
  });
});
