import { describe, expect, it } from 'vitest';
import { examplePlan } from '../../contracts/examples';
import { recapFromObjective } from './recap';

describe('recapFromObjective', () => {
  it('turns an imperative objective into a "You can now" line', () => {
    expect(recapFromObjective('Use acid to fix a drink that tastes flat or syrupy.')).toBe('You can now use acid to fix a drink that tastes flat or syrupy.');
    expect(recapFromObjective('Name the four things every balanced drink has: base, sour, sweet, dilution.')).toBe(
      'You can now name the four things every balanced drink has: base, sour, sweet, dilution.',
    );
  });

  it('reads well for every objective in the contract example plan', () => {
    for (const node of examplePlan.nodes) {
      const line = recapFromObjective(node.objective);
      expect(line).toMatch(/^You can now [a-z]/);
      expect(line).toMatch(/\.$/);
      expect(line).not.toMatch(/\.\.$/);
    }
  });

  it('drops a subject phrase in front of the capability', () => {
    expect(recapFromObjective('Learners will be able to order food politely in Indonesian')).toBe('You can now order food politely in Indonesian.');
    expect(recapFromObjective('You will be able to read a service history')).toBe('You can now read a service history.');
    expect(recapFromObjective('To spot a clocked odometer')).toBe('You can now spot a clocked odometer.');
  });

  it('treats an acronym or a name up front as a topic, keeping its capitals', () => {
    expect(recapFromObjective('SQL joins: combine two tables on a shared key')).toBe('You worked on SQL joins: combine two tables on a shared key.');
    expect(recapFromObjective('iOS: install an app from TestFlight')).toBe('You worked on iOS: install an app from TestFlight.');
  });

  it('uses "You worked on" for topic-style objectives instead of a broken sentence', () => {
    expect(recapFromObjective('How a four-stroke engine turns fuel into motion')).toBe('You worked on how a four-stroke engine turns fuel into motion.');
    expect(recapFromObjective('Understanding the basics of sourdough starters')).toBe('You worked on understanding the basics of sourdough starters.');
    expect(recapFromObjective('the parts of a trumpet')).toBe('You worked on the parts of a trumpet.');
  });

  it('returns null for an empty objective and clips a long one at a word', () => {
    expect(recapFromObjective('')).toBeNull();
    expect(recapFromObjective(undefined)).toBeNull();
    const long = recapFromObjective(`Explain ${'why the bubbles matter '.repeat(20)}`)!;
    expect(long.length).toBeLessThanOrEqual(172);
    expect(long).toMatch(/matter…\.$|bubbles…\.$|why…\.$|the…\.$/);
  });
});
