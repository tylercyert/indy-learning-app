/**
 * Pure mapping rules for mirroring GitHub Issues into Linear.
 *
 * No I/O here: everything is a deterministic function so it can be unit-tested and so the
 * dry-run plan is exactly what `--apply` would do. GitHub Issues remain the record; this
 * module only derives the Linear shape from a GitHub issue.
 */
import { createHash } from 'node:crypto';

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
  state: 'OPEN' | 'CLOSED';
  labels: string[];
  milestone: string | null;
  url: string;
};

/** Linear workflow state names the mirror targets. */
export type LinearStateName = 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';

/** Linear workflow state `type` values; used as a fallback when a state name is missing in the team. */
export type LinearStateType = 'backlog' | 'unstarted' | 'started' | 'completed';

export const STATE_FALLBACK_TYPE: Record<LinearStateName, LinearStateType> = {
  Backlog: 'backlog',
  Todo: 'unstarted',
  'In Progress': 'started',
  'In Review': 'started',
  Done: 'completed',
};

/** Linear priority: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low. */
export type LinearPriority = 0 | 1 | 2 | 3;

export const BLOCKED_LABEL = 'blocked';
export const MARKER_PREFIX = 'github:#';

/**
 * The idempotency key stored as its own line in the Linear description, e.g.
 * `github:#12 sync:3f9a0c1b2d4e`. The `sync:` part is a fingerprint of the generated body: Linear
 * re-serializes markdown (autolinks, `-`→`*` bullets, escaping), so the text itself cannot be
 * compared, but the fingerprint survives untouched.
 */
export const markerFor = (githubNumber: number, syncHash?: string): string =>
  `${MARKER_PREFIX}${githubNumber}${syncHash ? ` sync:${syncHash}` : ''}`;

const MARKER_LINE = /^\s*`?github:#(\d+)(?:\s+sync:([0-9a-f]+))?`?\s*$/m;

/** Finds the GitHub issue number encoded in a Linear description, or null when absent. */
export function parseMarker(description: string | null | undefined): number | null {
  if (!description) return null;
  const match = MARKER_LINE.exec(description);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The `sync:` fingerprint on the marker line, or null when absent (older mirrors, hand edits). */
export function parseSyncHash(description: string | null | undefined): string | null {
  if (!description) return null;
  return MARKER_LINE.exec(description)?.[2] ?? null;
}

/** Short, stable fingerprint of mirrored content. */
export const contentHash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);

/**
 * Lifecycle order from docs/factory.md. When an issue carries several `status:*` labels (the
 * rule is one per issue), the most advanced one wins so the board never under-reports progress.
 */
const STATUS_ORDER = ['status:backlog', 'status:ready', 'status:blocked', 'status:in-progress', 'status:review'] as const;

const STATUS_TO_STATE: Record<(typeof STATUS_ORDER)[number], LinearStateName> = {
  'status:backlog': 'Backlog',
  'status:ready': 'Todo',
  'status:blocked': 'Todo',
  'status:in-progress': 'In Progress',
  'status:review': 'In Review',
};

export type StatusMapping = { stateName: LinearStateName; blocked: boolean };

/** Closed issues are Done regardless of labels; open issues follow their `status:*` label. */
export function statusFromLabels(labels: readonly string[], state: GitHubIssue['state']): StatusMapping {
  if (state === 'CLOSED') return { stateName: 'Done', blocked: false };
  const blocked = labels.includes('status:blocked');
  let best: (typeof STATUS_ORDER)[number] | undefined;
  for (const candidate of STATUS_ORDER) {
    if (labels.includes(candidate)) best = candidate;
  }
  return { stateName: best ? STATUS_TO_STATE[best] : 'Backlog', blocked };
}

/** `priority:p0` → 1 (urgent), `p1` → 2 (high), `p2` → 3 (medium); otherwise 0. Highest wins. */
export function priorityFromLabels(labels: readonly string[]): LinearPriority {
  if (labels.includes('priority:p0')) return 1;
  if (labels.includes('priority:p1')) return 2;
  if (labels.includes('priority:p2')) return 3;
  return 0;
}

/** `area:*` labels are mirrored by name; `blocked` is added when the GitHub status is blocked. */
export function linearLabelsFor(labels: readonly string[], blocked: boolean): string[] {
  const areas = labels.filter((l) => l.startsWith('area:'));
  const out = new Set<string>(areas);
  if (blocked) out.add(BLOCKED_LABEL);
  return [...out].sort();
}

/** Linear description: marker line (with fingerprint) first, then provenance, then the GitHub body verbatim. */
export function buildDescription(issue: GitHubIssue): string {
  const lines = [`Mirrored from ${issue.url} — GitHub is the record; edit there, not here.`];
  if (issue.milestone) lines.push(`Milestone: ${issue.milestone}`);
  const body = issue.body.replace(/\r\n?/g, '\n').trim();
  if (body) lines.push('', '---', '', body);
  const rest = lines.join('\n');
  return `${markerFor(issue.number, contentHash(rest))}\n${rest}`;
}

export type DesiredIssue = {
  githubNumber: number;
  githubUrl: string;
  title: string;
  description: string;
  stateName: LinearStateName;
  priority: LinearPriority;
  labels: string[];
};

export function toDesired(issue: GitHubIssue): DesiredIssue {
  const { stateName, blocked } = statusFromLabels(issue.labels, issue.state);
  return {
    githubNumber: issue.number,
    githubUrl: issue.url,
    title: issue.title,
    description: buildDescription(issue),
    stateName,
    priority: priorityFromLabels(issue.labels),
    labels: linearLabelsFor(issue.labels, blocked),
  };
}

export type ExistingLinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  stateName: string;
  priority: number;
  labels: string[];
  attachmentUrls: string[];
};

export type PlanItem =
  | { kind: 'create'; desired: DesiredIssue }
  | { kind: 'update'; desired: DesiredIssue; existing: ExistingLinearIssue; changes: string[] }
  | { kind: 'unchanged'; desired: DesiredIssue; existing: ExistingLinearIssue };

/** Indexes existing Linear issues by the GitHub number in their marker line. Duplicates keep the first. */
export function indexByMarker(existing: readonly ExistingLinearIssue[]): Map<number, ExistingLinearIssue> {
  const map = new Map<number, ExistingLinearIssue>();
  for (const issue of existing) {
    const n = parseMarker(issue.description);
    if (n !== null && !map.has(n)) map.set(n, issue);
  }
  return map;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Field-level diff between the desired mirror and an existing Linear issue. */
export function diffIssue(desired: DesiredIssue, existing: ExistingLinearIssue): string[] {
  const changes: string[] = [];
  if (existing.title !== desired.title) changes.push(`title: ${JSON.stringify(existing.title)} → ${JSON.stringify(desired.title)}`);
  const existingHash = parseSyncHash(existing.description);
  if (existingHash === null || existingHash !== parseSyncHash(desired.description)) changes.push('description');
  if (existing.stateName !== desired.stateName) changes.push(`state: ${existing.stateName} → ${desired.stateName}`);
  if (existing.priority !== desired.priority) changes.push(`priority: ${existing.priority} → ${desired.priority}`);
  if (!sameSet(existing.labels, desired.labels))
    changes.push(`labels: [${existing.labels.join(', ')}] → [${desired.labels.join(', ')}]`);
  if (!existing.attachmentUrls.includes(desired.githubUrl)) changes.push('attachment: link GitHub URL');
  return changes;
}

/** Decides create/update/unchanged per desired issue. Never proposes deletes. */
export function planChanges(desired: readonly DesiredIssue[], existing: readonly ExistingLinearIssue[]): PlanItem[] {
  const index = indexByMarker(existing);
  return desired.map((d) => {
    const found = index.get(d.githubNumber);
    if (!found) return { kind: 'create', desired: d };
    const changes = diffIssue(d, found);
    return changes.length ? { kind: 'update', desired: d, existing: found, changes } : { kind: 'unchanged', desired: d, existing: found };
  });
}

/** Human-readable plan, suitable for pasting into the tracking issue. */
export function summarizePlan(items: readonly PlanItem[]): string {
  const counts = { create: 0, update: 0, unchanged: 0 };
  const lines: string[] = [];
  for (const item of items) {
    counts[item.kind] += 1;
    const d = item.desired;
    const head = `#${d.githubNumber} ${d.title}`;
    const shape = `${d.stateName} · p${d.priority} · [${d.labels.join(', ') || '—'}]`;
    if (item.kind === 'create') lines.push(`CREATE  ${head}  →  ${shape}`);
    else if (item.kind === 'update') lines.push(`UPDATE  ${item.existing.identifier}  ${head}  →  ${shape}\n        ${item.changes.join('; ')}`);
    else lines.push(`KEEP    ${item.existing.identifier}  ${head}`);
  }
  lines.push('', `Plan: ${counts.create} create, ${counts.update} update, ${counts.unchanged} unchanged (${items.length} GitHub issues).`);
  return lines.join('\n');
}
