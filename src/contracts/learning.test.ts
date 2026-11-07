import { describe, expect, it } from 'vitest';
import { LearningPreferencesV1Schema } from './learning';

const preferences = {
  schemaVersion: 1,
  goal: 'Learn how to balance a non-alcoholic party drink',
  experience: 'beginner',
  pace: 'gentle',
};

describe('LearningPreferencesV1Schema', () => {
  it('accepts a beginner goal and normalizes surrounding whitespace', () => {
    expect(LearningPreferencesV1Schema.parse({ ...preferences, goal: '  Learn balance  ' }).goal)
      .toBe('Learn balance');
  });
  it('supports a level-up path without treating it as proven mastery', () => {
    expect(LearningPreferencesV1Schema.parse({ ...preferences, experience: 'level-up' }).experience)
      .toBe('level-up');
  });
  it.each(['', '  ', 'a'.repeat(501)])('rejects empty or oversized goals', (goal) => {
    expect(LearningPreferencesV1Schema.safeParse({ ...preferences, goal }).success).toBe(false);
  });
  it.each([
    { schemaVersion: 2 }, { pace: 'instant' }, { experience: 'expert' },
    { permanentLearningStyle: 'visual' }, { goal: 42 },
  ])('rejects malformed, unversioned or unsupported input: %j', (invalid) => {
    expect(LearningPreferencesV1Schema.safeParse({ ...preferences, ...invalid }).success).toBe(false);
  });
  it('requires the schema version', () => {
    const { schemaVersion: _, ...unversioned } = preferences;
    expect(LearningPreferencesV1Schema.safeParse(unversioned).success).toBe(false);
  });
});
