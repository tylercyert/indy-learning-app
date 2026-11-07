/**
 * Minimal Linear GraphQL client (fetch only, no SDK). Shapes were checked against the public
 * schema via introspection at https://api.linear.app/graphql; see docs/linear.md for sources.
 */
import { z } from 'zod';
import type { ExistingLinearIssue, LinearStateName, LinearStateType } from './mapping';

export const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

export type LinearTeam = { id: string; key: string; name: string };
export type LinearWorkflowState = { id: string; name: string; type: string; position: number };
export type LinearLabel = { id: string; name: string; teamId: string | null };

const StateSchema = z.object({ id: z.string(), name: z.string(), type: z.string(), position: z.number() });
const LabelSchema = z.object({ id: z.string(), name: z.string(), team: z.object({ id: z.string() }).nullable() });
const PageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

const IssueNodeSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.number(),
  state: z.object({ name: z.string() }),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  attachments: z.object({ nodes: z.array(z.object({ url: z.string() })) }),
});

export class LinearClient {
  constructor(private readonly apiKey: string) {}

  /** Personal API keys are sent bare (no `Bearer`), per Linear's GraphQL docs. */
  async query<T>(query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const res = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.apiKey },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      throw new Error(`Linear rate limit hit (requests remaining: ${res.headers.get('X-RateLimit-Requests-Remaining') ?? '?'}).`);
    }
    const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
    if (!res.ok || json.errors?.length) {
      const detail = json.errors?.map((e) => e.message).join('; ') ?? `HTTP ${res.status}`;
      throw new Error(`Linear GraphQL error: ${detail}`);
    }
    return schema.parse(json.data);
  }

  async viewer(): Promise<{ name: string; email: string }> {
    const data = await this.query(
      `query { viewer { name email } }`,
      {},
      z.object({ viewer: z.object({ name: z.string(), email: z.string() }) }),
    );
    return data.viewer;
  }

  async teamByKey(key: string): Promise<LinearTeam> {
    const data = await this.query(
      `query Team($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id key name } } }`,
      { key },
      z.object({ teams: z.object({ nodes: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })) }) }),
    );
    const team = data.teams.nodes[0];
    if (!team) throw new Error(`No Linear team with key "${key}". Check LINEAR_TEAM_KEY in .env.linear.`);
    return team;
  }

  async workflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const data = await this.query(
      `query States($teamId: ID!) { workflowStates(filter: { team: { id: { eq: $teamId } } }, first: 100) { nodes { id name type position } } }`,
      { teamId },
      z.object({ workflowStates: z.object({ nodes: z.array(StateSchema) }) }),
    );
    return data.workflowStates.nodes;
  }

  /** Team-scoped labels plus workspace-level labels (team is null), both usable on team issues. */
  async labels(teamId: string): Promise<LinearLabel[]> {
    const data = await this.query(
      `query Labels($teamId: ID!) {
        issueLabels(filter: { or: [{ team: { id: { eq: $teamId } } }, { team: { null: true } }], isGroup: { eq: false } }, first: 250) {
          nodes { id name team { id } }
        }
      }`,
      { teamId },
      z.object({ issueLabels: z.object({ nodes: z.array(LabelSchema) }) }),
    );
    return data.issueLabels.nodes.map((l) => ({ id: l.id, name: l.name, teamId: l.team?.id ?? null }));
  }

  /** Every issue in the team whose description carries a `github:#` marker line (paginated). */
  async mirroredIssues(teamId: string, markerPrefix: string): Promise<ExistingLinearIssue[]> {
    const out: ExistingLinearIssue[] = [];
    let after: string | null = null;
    do {
      const data: { issues: { nodes: z.infer<typeof IssueNodeSchema>[]; pageInfo: z.infer<typeof PageInfo> } } = await this.query(
        `query Mirrored($teamId: ID!, $marker: String!, $after: String) {
          issues(filter: { team: { id: { eq: $teamId } }, description: { contains: $marker } }, first: 50, after: $after, includeArchived: true) {
            nodes {
              id identifier title description priority
              state { name }
              labels { nodes { name } }
              attachments { nodes { url } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { teamId, marker: markerPrefix, after },
        z.object({ issues: z.object({ nodes: z.array(IssueNodeSchema), pageInfo: PageInfo }) }),
      );
      for (const n of data.issues.nodes) {
        out.push({
          id: n.id,
          identifier: n.identifier,
          title: n.title,
          description: n.description,
          stateName: n.state.name,
          priority: n.priority,
          labels: n.labels.nodes.map((l) => l.name),
          attachmentUrls: n.attachments.nodes.map((a) => a.url),
        });
      }
      after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null;
    } while (after);
    return out;
  }

  async createLabel(teamId: string, name: string): Promise<LinearLabel> {
    const data = await this.query(
      `mutation CreateLabel($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { success issueLabel { id name } } }`,
      { input: { teamId, name } },
      z.object({ issueLabelCreate: z.object({ success: z.boolean(), issueLabel: z.object({ id: z.string(), name: z.string() }) }) }),
    );
    return { id: data.issueLabelCreate.issueLabel.id, name, teamId };
  }

  async createIssue(input: {
    teamId: string;
    title: string;
    description: string;
    stateId: string;
    priority: number;
    labelIds: string[];
  }): Promise<{ id: string; identifier: string; url: string }> {
    const data = await this.query(
      `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
      { input },
      z.object({ issueCreate: z.object({ success: z.boolean(), issue: z.object({ id: z.string(), identifier: z.string(), url: z.string() }) }) }),
    );
    return data.issueCreate.issue;
  }

  async updateIssue(
    id: string,
    input: { title?: string; description?: string; stateId?: string; priority?: number; labelIds?: string[] },
  ): Promise<void> {
    await this.query(
      `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
      { id, input },
      z.object({ issueUpdate: z.object({ success: z.boolean() }) }),
    );
  }

  /** Attachment URLs are idempotent per issue: re-creating with the same URL updates in place. */
  async attachUrl(issueId: string, url: string, title: string): Promise<void> {
    await this.query(
      `mutation Attach($input: AttachmentCreateInput!) { attachmentCreate(input: $input) { success } }`,
      { input: { issueId, url, title } },
      z.object({ attachmentCreate: z.object({ success: z.boolean() }) }),
    );
  }
}

/**
 * Resolves a target state by exact name, else by the first state of the fallback type.
 * Returns the resolved state and a note when a fallback was used.
 */
export function resolveState(
  states: readonly LinearWorkflowState[],
  name: LinearStateName,
  fallbackType: LinearStateType,
): { state: LinearWorkflowState; note?: string } {
  const exact = states.find((s) => s.name === name);
  if (exact) return { state: exact };
  const byType = [...states].filter((s) => s.type === fallbackType).sort((a, b) => a.position - b.position)[0];
  if (!byType) throw new Error(`Team has no workflow state named "${name}" and none of type "${fallbackType}".`);
  return { state: byType, note: `No state named "${name}" in the team; using "${byType.name}" (type ${fallbackType}). Add "${name}" in Team settings → Workflow for an exact board column.` };
}
