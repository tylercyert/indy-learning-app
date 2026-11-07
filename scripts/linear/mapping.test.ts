import { describe, expect, it } from 'vitest';
import {
  buildDescription,
  diffIssue,
  indexByMarker,
  linearLabelsFor,
  markerFor,
  parseSyncHash,
  parseMarker,
  planChanges,
  priorityFromLabels,
  statusFromLabels,
  summarizePlan,
  toDesired,
  type ExistingLinearIssue,
  type GitHubIssue,
} from './mapping';

const gh = (over: Partial<GitHubIssue> = {}): GitHubIssue => ({
  number: 12,
  title: 'Hosting decision',
  body: 'Decide where demos live.',
  state: 'OPEN',
  labels: ['status:backlog', 'priority:p2', 'area:infra'],
  milestone: null,
  url: 'https://github.com/tylercyert/indy-learning-app/issues/12',
  ...over,
});

const existing = (over: Partial<ExistingLinearIssue> = {}): ExistingLinearIssue => ({
  id: 'uuid-12',
  identifier: 'IND-7',
  title: 'Hosting decision',
  description: buildDescription(gh()),
  stateName: 'Backlog',
  priority: 3,
  labels: ['area:infra'],
  attachmentUrls: ['https://github.com/tylercyert/indy-learning-app/issues/12'],
  ...over,
});

describe('statusFromLabels', () => {
  it('maps each status label to its Linear state', () => {
    expect(statusFromLabels(['status:backlog'], 'OPEN')).toEqual({ stateName: 'Backlog', blocked: false });
    expect(statusFromLabels(['status:ready'], 'OPEN')).toEqual({ stateName: 'Todo', blocked: false });
    expect(statusFromLabels(['status:in-progress'], 'OPEN')).toEqual({ stateName: 'In Progress', blocked: false });
    expect(statusFromLabels(['status:review'], 'OPEN')).toEqual({ stateName: 'In Review', blocked: false });
  });
  it('blocked goes to Todo and flags the blocked label', () => {
    expect(statusFromLabels(['status:blocked', 'area:app'], 'OPEN')).toEqual({ stateName: 'Todo', blocked: true });
  });
  it('closed issues are Done whatever the label says', () => {
    expect(statusFromLabels(['status:review'], 'CLOSED')).toEqual({ stateName: 'Done', blocked: false });
    expect(statusFromLabels(['status:blocked'], 'CLOSED')).toEqual({ stateName: 'Done', blocked: false });
  });
  it('defaults to Backlog without a status label', () => {
    expect(statusFromLabels(['bug'], 'OPEN').stateName).toBe('Backlog');
  });
  it('picks the most advanced status when several are present', () => {
    expect(statusFromLabels(['status:backlog', 'status:in-progress'], 'OPEN').stateName).toBe('In Progress');
  });
});

describe('priorityFromLabels', () => {
  it('maps p0/p1/p2 to 1/2/3 and nothing to 0', () => {
    expect(priorityFromLabels(['priority:p0'])).toBe(1);
    expect(priorityFromLabels(['priority:p1'])).toBe(2);
    expect(priorityFromLabels(['priority:p2'])).toBe(3);
    expect(priorityFromLabels(['area:app'])).toBe(0);
  });
  it('highest priority wins when several are present', () => {
    expect(priorityFromLabels(['priority:p2', 'priority:p0'])).toBe(1);
  });
});

describe('linearLabelsFor', () => {
  it('keeps area labels, sorted, and drops status/priority/other labels', () => {
    expect(linearLabelsFor(['status:ready', 'area:quality', 'priority:p1', 'area:app', 'bug'], false)).toEqual([
      'area:app',
      'area:quality',
    ]);
  });
  it('adds blocked when requested, once', () => {
    expect(linearLabelsFor(['area:app'], true)).toEqual(['area:app', 'blocked']);
  });
});

describe('marker', () => {
  it('round-trips through the description', () => {
    expect(parseMarker(buildDescription(gh({ number: 42 })))).toBe(42);
  });
  it('matches a marker wrapped in backticks or surrounded by whitespace', () => {
    expect(parseMarker('intro\n  `github:#7`  \nmore')).toBe(7);
  });
  it('does not match a marker embedded in prose or a different prefix', () => {
    expect(parseMarker('see github:#7 for context')).toBeNull();
    expect(parseMarker('gitlab:#7')).toBeNull();
    expect(parseMarker(null)).toBeNull();
    expect(parseMarker('')).toBeNull();
  });
  it('markerFor with the fingerprint is the first line of the description', () => {
    const text = buildDescription(gh({ number: 3 }));
    expect(text.split('\n')[0]).toBe(markerFor(3, parseSyncHash(text) ?? ''));
    expect(markerFor(3)).toBe('github:#3');
  });
});

describe('buildDescription', () => {
  it('includes provenance, milestone and body', () => {
    const text = buildDescription(gh({ milestone: 'First complete learning loop' }));
    expect(text).toContain('Mirrored from https://github.com/tylercyert/indy-learning-app/issues/12');
    expect(text).toContain('Milestone: First complete learning loop');
    expect(text.endsWith('Decide where demos live.')).toBe(true);
  });
  it('omits the body separator when the body is empty', () => {
    expect(buildDescription(gh({ body: '   ' }))).not.toContain('---');
  });
});

describe('sync fingerprint', () => {
  it('is on the marker line and parses back', () => {
    const text = buildDescription(gh());
    const first = text.split('\n')[0] ?? '';
    expect(first).toMatch(/^github:#12 sync:[0-9a-f]{12}$/);
    expect(parseSyncHash(text)).toBe(first.split('sync:')[1]);
    expect(parseMarker(text)).toBe(12);
  });
  it('is stable for the same content and changes with body, milestone or CRLF-insensitive body', () => {
    expect(buildDescription(gh())).toBe(buildDescription(gh()));
    expect(parseSyncHash(buildDescription(gh({ body: 'other' })))).not.toBe(parseSyncHash(buildDescription(gh())));
    expect(parseSyncHash(buildDescription(gh({ milestone: 'M' })))).not.toBe(parseSyncHash(buildDescription(gh())));
    expect(parseSyncHash(buildDescription(gh({ body: 'a\r\nb' })))).toBe(parseSyncHash(buildDescription(gh({ body: 'a\nb' }))));
  });
  it('ignores how Linear re-serializes the stored markdown', () => {
    const desired = toDesired(gh({ body: '- item ~1\n- item *2' }));
    const stored = desired.description
      .replace(gh().url, `[${gh().url}](<${gh().url}>)`)
      .replace('- item ~1\n- item *2', '\n* item \\~1\n* item \\*2\n');
    expect(diffIssue(desired, existing({ description: stored }))).toEqual([]);
  });
  it('treats a marker without a fingerprint as a description change', () => {
    expect(diffIssue(toDesired(gh()), existing({ description: 'github:#12\nold mirror' }))).toEqual(['description']);
    expect(parseSyncHash('github:#12\nold mirror')).toBeNull();
    expect(parseSyncHash(null)).toBeNull();
  });
});

describe('toDesired', () => {
  it('derives the full Linear shape', () => {
    expect(toDesired(gh({ labels: ['status:blocked', 'priority:p0', 'area:app', 'area:data'] }))).toMatchObject({
      githubNumber: 12,
      title: 'Hosting decision',
      stateName: 'Todo',
      priority: 1,
      labels: ['area:app', 'area:data', 'blocked'],
    });
  });
});

describe('planChanges', () => {
  it('creates when no Linear issue carries the marker', () => {
    const plan = planChanges([toDesired(gh())], []);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.kind).toBe('create');
  });
  it('is unchanged when the mirror already matches', () => {
    const plan = planChanges([toDesired(gh())], [existing()]);
    expect(plan[0]?.kind).toBe('unchanged');
  });
  it('updates with field-level changes when the GitHub side moved', () => {
    const plan = planChanges([toDesired(gh({ labels: ['status:review', 'priority:p0', 'area:infra'] }))], [existing()]);
    const item = plan[0];
    expect(item?.kind).toBe('update');
    if (item?.kind !== 'update') throw new Error('expected update');
    expect(item.changes).toEqual(['state: Backlog → In Review', 'priority: 3 → 1']);
    expect(item.changes).not.toContain('attachment: link GitHub URL');
  });
  it('reports a description change when the GitHub body or milestone moves', () => {
    const changes = diffIssue(toDesired(gh({ milestone: 'First complete learning loop' })), existing());
    expect(changes).toEqual(['description']);
  });
  it('requests the attachment when the GitHub URL is not yet linked', () => {
    expect(diffIssue(toDesired(gh()), existing({ attachmentUrls: [] }))).toEqual(['attachment: link GitHub URL']);
  });
  it('ignores label order', () => {
    expect(
      diffIssue(toDesired(gh({ labels: ['status:backlog', 'priority:p2', 'area:infra', 'area:app'] })), existing({ labels: ['area:infra', 'area:app'], description: buildDescription(gh({ labels: ['status:backlog', 'priority:p2', 'area:infra', 'area:app'] })) })),
    ).toEqual([]);
  });
  it('never proposes deletes for Linear issues without a GitHub counterpart', () => {
    const plan = planChanges([], [existing()]);
    expect(plan).toEqual([]);
  });
  it('indexes by marker and keeps the first duplicate', () => {
    const index = indexByMarker([existing({ identifier: 'IND-1' }), existing({ identifier: 'IND-2' })]);
    expect(index.get(12)?.identifier).toBe('IND-1');
  });
});

describe('summarizePlan', () => {
  it('counts creates, updates and unchanged', () => {
    const text = summarizePlan([
      { kind: 'create', desired: toDesired(gh({ number: 1 })) },
      { kind: 'update', desired: toDesired(gh({ number: 2 })), existing: existing(), changes: ['description'] },
      { kind: 'unchanged', desired: toDesired(gh({ number: 3 })), existing: existing() },
    ]);
    expect(text).toContain('Plan: 1 create, 1 update, 1 unchanged (3 GitHub issues).');
    expect(text).toContain('CREATE  #1');
    expect(text).toContain('UPDATE  IND-7  #2');
    expect(text).toContain('KEEP    IND-7  #3');
  });
});
