import { describe, expect, it } from 'vitest';
import type { NodeV1 } from '../../../src/contracts';
import { prefixNodeIds } from './node-ids';

const nodes: NodeV1[] = [
  { id: 'basics', lessonId: '00000000-0000-4000-8000-000000000001', title: 'Basics', objective: 'o', kind: 'core', required: true, rule: {} },
  { id: 'apply', lessonId: '00000000-0000-4000-8000-000000000002', title: 'Apply', objective: 'o', kind: 'core', required: true, rule: { allOf: ['basics'] } },
  { id: 'extra', lessonId: '00000000-0000-4000-8000-000000000003', title: 'Extra', objective: 'o', kind: 'optional', required: false, rule: { anyOf: ['basics', 'apply'], atLeast: { count: 1, of: ['basics', 'apply'] } } },
];

describe('prefixNodeIds', () => {
  it('leaves the first tree alone', () => {
    expect(prefixNodeIds(nodes, 0)).toBe(nodes);
  });
  it('prefixes ids and every rule reference for later trees', () => {
    const out = prefixNodeIds(nodes, 2);
    expect(out.map((n) => n.id)).toEqual(['t2-basics', 't2-apply', 't2-extra']);
    expect(out[1]!.rule).toEqual({ allOf: ['t2-basics'] });
    expect(out[2]!.rule).toEqual({ anyOf: ['t2-basics', 't2-apply'], atLeast: { count: 1, of: ['t2-basics', 't2-apply'] } });
    expect(out[0]!.rule).toEqual({});
  });
});
