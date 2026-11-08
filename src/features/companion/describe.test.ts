import { describe, expect, it } from 'vitest';
import { BASE_COMPANION, CompanionMoodSchema } from '../../contracts';
import { describeCompanion, describeCompanionFace, MOOD_PHRASE } from './describe';

describe('companion descriptions', () => {
  it('say every mood in human words, never the raw token', () => {
    for (const mood of CompanionMoodSchema.options) {
      const label = describeCompanion(BASE_COMPANION, mood);
      expect(label).toContain(MOOD_PHRASE[mood]);
      expect(label.split(', ')).not.toContain(mood);
    }
  });

  it('name the companion and its headpiece', () => {
    expect(describeCompanion({ ...BASE_COMPANION, name: 'Zest', headpiece: 'sprig' }, 'cheering')).toBe('Zest, your companion, cheering you on, wearing a sprig');
    expect(describeCompanion({ ...BASE_COMPANION, name: 'Zest', headpiece: 'none' }, 'thinking')).toBe('Zest, your companion, thinking it over');
  });

  it('describe the face alone with the same wording', () => {
    expect(describeCompanionFace({ ...BASE_COMPANION, name: 'Poko' }, 'curious')).toBe('Poko, looking curious');
  });
});
