/**
 * Read-only GitHub access through the authenticated `gh` CLI. This module never writes to GitHub.
 */
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import type { GitHubIssue } from './mapping';

const GhIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable().default(''),
  state: z.enum(['OPEN', 'CLOSED']),
  labels: z.array(z.object({ name: z.string() })),
  milestone: z.object({ title: z.string() }).nullable(),
  url: z.string().url(),
});

const gh = (args: string[]): string =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });

/** `owner/name` of the repository the current directory belongs to. */
export function detectRepo(): string {
  const out = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  return out.trim();
}

/** All issues (open and closed), ascending by number. Pull requests are excluded by `gh issue list`. */
export function listGitHubIssues(repo: string): GitHubIssue[] {
  const raw = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--limit',
    '1000',
    '--json',
    'number,title,body,state,labels,milestone,url',
  ]);
  const parsed = z.array(GhIssueSchema).parse(JSON.parse(raw));
  return parsed
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? '',
      state: i.state,
      labels: i.labels.map((l) => l.name),
      milestone: i.milestone?.title ?? null,
      url: i.url,
    }))
    .sort((a, b) => a.number - b.number);
}
