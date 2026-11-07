import { describe, expect, it } from 'vitest';
import type { LearnerContextV1 } from '../../../src/contracts';

process.env.ALLOW_NO_AI = '1';
process.env.DATABASE_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY;

const context: LearnerContextV1 = {
  schemaVersion: 1,
  goal: { topic: 'mixology', statement: 'party', outcome: 'balanced drinks', application: null },
  experience: { level: 'new', notes: null },
  horizon: 'quickWin',
  facts: [],
  constraints: [],
};

describe('reconstructTurn', () => {
  it('rebuilds an ask turn with the stored quick answers while the intake is open', async () => {
    const { reconstructTurn } = await import('./intake');
    const turn = reconstructTurn(
      'open',
      [
        { role: 'learner', text: 'teach me cocktails', at: '2026-11-07T18:00:00.000Z' },
        { role: 'companion', text: 'Have you mixed before?', at: '2026-11-07T18:00:05.000Z', suggestedAnswers: ['Never', 'A few'] },
      ],
      null,
    );
    expect(turn).toEqual({ kind: 'ask', question: 'Have you mixed before?', suggestedAnswers: ['Never', 'A few'] });
  });

  it('rebuilds a ready turn from the stored context and summary', async () => {
    const { reconstructTurn } = await import('./intake');
    const turn = reconstructTurn(
      'ready',
      [
        { role: 'learner', text: 'teach me cocktails', at: '2026-11-07T18:00:00.000Z' },
        { role: 'companion', text: 'Got it, here is the plan.', at: '2026-11-07T18:00:05.000Z' },
      ],
      context,
    );
    expect(turn).toEqual({ kind: 'ready', context, summary: 'Got it, here is the plan.' });
  });

  it('returns null before the companion has spoken', async () => {
    const { reconstructTurn } = await import('./intake');
    expect(reconstructTurn('open', [{ role: 'learner', text: 'hi', at: '2026-11-07T18:00:00.000Z' }], null)).toBeNull();
  });
});
