import { describe, expect, it } from 'vitest';
import { exampleSlides, exampleTree } from '../contracts/examples';
import type { LearningExperienceV1 } from '../contracts';
import {
  deriveNodeStates,
  displayedStreak,
  isExperienceComplete,
  isRuleSatisfied,
  isTreeComplete,
  nextNode,
  recordActivity,
  remainingAssessables,
  scoreMultipleChoice,
  treeProgress,
} from './index';

const lessonId = (nodeId: string) => exampleTree.nodes.find((n) => n.id === nodeId)!.lessonId;
const done = (...nodeIds: string[]) => new Set(nodeIds.map(lessonId));

describe('isRuleSatisfied', () => {
  const completed = new Set(['a', 'b']);
  it('treats an empty rule as satisfied', () => expect(isRuleSatisfied({}, completed)).toBe(true));
  it('allOf needs every id', () => {
    expect(isRuleSatisfied({ allOf: ['a', 'b'] }, completed)).toBe(true);
    expect(isRuleSatisfied({ allOf: ['a', 'c'] }, completed)).toBe(false);
  });
  it('anyOf needs one id', () => {
    expect(isRuleSatisfied({ anyOf: ['c', 'b'] }, completed)).toBe(true);
    expect(isRuleSatisfied({ anyOf: ['c', 'd'] }, completed)).toBe(false);
  });
  it('atLeast counts hits', () => {
    expect(isRuleSatisfied({ atLeast: { count: 2, of: ['a', 'b', 'c'] } }, completed)).toBe(true);
    expect(isRuleSatisfied({ atLeast: { count: 3, of: ['a', 'b', 'c'] } }, completed)).toBe(false);
  });
  it('requires every present clause', () => {
    expect(isRuleSatisfied({ allOf: ['a'], anyOf: ['c', 'd'] }, completed)).toBe(false);
  });
  it('treats empty arrays and nulls as absent clauses (models send [] for roots)', () => {
    expect(isRuleSatisfied({ allOf: [], anyOf: [], atLeast: null }, new Set())).toBe(true);
    expect(isRuleSatisfied({ allOf: ['a'], anyOf: [] }, completed)).toBe(true);
  });
});

describe('deriveNodeStates / nextNode / completion', () => {
  it('starts with only the orientation available', () => {
    const states = deriveNodeStates(exampleTree, new Set());
    expect(states).toEqual({ orientation: 'available', acidity: 'locked', dilution: 'locked', 'non-alc': 'locked', design: 'locked' });
    expect(nextNode(exampleTree, new Set())?.id).toBe('orientation');
  });
  it('unlocks siblings after orientation and points at the first available in order', () => {
    const states = deriveNodeStates(exampleTree, done('orientation'));
    expect(states.acidity).toBe('available');
    expect(states.dilution).toBe('available');
    expect(states['non-alc']).toBe('locked');
    expect(nextNode(exampleTree, done('orientation'))?.id).toBe('acidity');
  });
  it('atLeast 2 of 3 unlocks design with acidity + dilution, optional branch not needed', () => {
    const states = deriveNodeStates(exampleTree, done('orientation', 'acidity', 'dilution'));
    expect(states.design).toBe('available');
  });
  it('tree completes when required nodes are done even if the optional branch is not', () => {
    const completed = done('orientation', 'acidity', 'dilution', 'design');
    expect(isTreeComplete(exampleTree, completed)).toBe(true);
    expect(treeProgress(exampleTree, completed)).toEqual({ completed: 4, required: 4, total: 5 });
    expect(nextNode(exampleTree, completed)?.id).toBe('non-alc');
  });
  it('recognizes a lesson completed elsewhere (same lesson id, different tree)', () => {
    const otherTree = { ...exampleTree, id: '9a3f6a9c-9c4e-4a1b-8d2e-1f0c7b6a5d43', nodes: exampleTree.nodes.map((n) => ({ ...n, id: `x-${n.id}`, rule: {} })) };
    expect(deriveNodeStates(otherTree, done('acidity'))['x-acidity']).toBe('completed');
  });
});

describe('scoreMultipleChoice', () => {
  const q = exampleSlides.slides[1]!.components[0] as Extract<(typeof exampleSlides.slides)[number]['components'][number], { type: 'multipleChoice' }>;
  it('marks the correct option and returns its explanation', () => {
    const scored = scoreMultipleChoice(q, 'b', 1);
    expect(scored.result.correct).toBe(true);
    expect(scored.explanation).toMatch(/Acid is the lever/);
  });
  it('marks a wrong option and still returns a teaching explanation', () => {
    const scored = scoreMultipleChoice(q, 'd', 2);
    expect(scored.result).toEqual({ type: 'multipleChoice', componentId: 'q1', selectedOptionId: 'd', correct: false, attempt: 2 });
    expect(scored.explanation).toMatch(/Dilution/);
    expect(scored.correctOptionId).toBe('b');
  });
  it('throws on an option that is not on the component', () => {
    expect(() => scoreMultipleChoice(q, 'zz', 1)).toThrow(/not on component/);
  });
});

describe('isExperienceComplete', () => {
  const experience: LearningExperienceV1 = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    lessonId: lessonId('acidity'),
    lessonContentVersion: 1,
    learnerId: '22222222-2222-4222-8222-222222222222',
    courseId: exampleTree.courseId,
    slides: exampleSlides.slides,
    generatedBy: 'test',
    generatedAt: '2026-11-07T18:00:00.000Z',
  };
  const allSlides = new Set(experience.slides.map((s) => s.id));
  it('is incomplete until every slide is viewed', () => {
    expect(isExperienceComplete(experience, new Set(['why-sour']), [])).toBe(false);
  });
  it('is incomplete until every assessable has a result, right or wrong', () => {
    expect(isExperienceComplete(experience, allSlides, [])).toBe(false);
    expect(remainingAssessables(experience, [])).toEqual(['q1']);
    const wrong = { type: 'multipleChoice' as const, componentId: 'q1', selectedOptionId: 'd', correct: false, attempt: 1 };
    expect(isExperienceComplete(experience, allSlides, [wrong])).toBe(true);
  });
  it('does not require the checklist (interactive, never scored)', () => {
    const right = { type: 'multipleChoice' as const, componentId: 'q1', selectedOptionId: 'b', correct: true, attempt: 1 };
    expect(isExperienceComplete(experience, allSlides, [right])).toBe(true);
  });
});

describe('streak', () => {
  it('starts at 1, increments on consecutive days, is idempotent within a day', () => {
    let s = recordActivity({ count: 0, lastActiveDate: null }, '2026-11-07');
    expect(s).toEqual({ count: 1, lastActiveDate: '2026-11-07' });
    s = recordActivity(s, '2026-11-07');
    expect(s.count).toBe(1);
    s = recordActivity(s, '2026-11-08');
    expect(s.count).toBe(2);
  });
  it('resets to 1 after a missed day and handles month boundaries', () => {
    const s = recordActivity({ count: 5, lastActiveDate: '2026-10-31' }, '2026-11-01');
    expect(s.count).toBe(6);
    expect(recordActivity(s, '2026-11-03').count).toBe(1);
  });
  it('displays 0 once the streak has lapsed, without mutating it', () => {
    const s = { count: 4, lastActiveDate: '2026-11-05' };
    expect(displayedStreak(s, '2026-11-06')).toBe(4);
    expect(displayedStreak(s, '2026-11-07')).toBe(0);
  });
});
