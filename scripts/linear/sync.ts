/**
 * Mirror GitHub Issues into a Linear team. GitHub is the record; this script only reads GitHub and
 * only writes Linear. Dry-run is the default and the only mode available without LINEAR_API_KEY.
 *
 *   npm run linear:sync                 # dry-run (offline plan if no key; live diff if key present)
 *   npm run linear:sync -- --apply      # create/update Linear issues (requires .env.linear)
 *   npm run linear:sync -- --repo owner/name
 *   LINEAR_ENV=/path/to/.env.linear npm run linear:sync   # read config from another checkout
 *
 * Config: .env.linear at the repo root (gitignored) with LINEAR_API_KEY and LINEAR_TEAM_KEY.
 */
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';
import { detectRepo, listGitHubIssues } from './github';
import { LinearClient, resolveState, type LinearLabel, type LinearWorkflowState } from './linear';
import {
  MARKER_PREFIX,
  STATE_FALLBACK_TYPE,
  planChanges,
  summarizePlan,
  toDesired,
  type DesiredIssue,
  type LinearStateName,
  type PlanItem,
} from './mapping';

type Args = { apply: boolean; repo: string | null };

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { apply: false, repo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--repo') {
      const v = argv[i + 1];
      if (!v) throw new Error('--repo needs a value like owner/name');
      args.repo = v;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: linear:sync [--dry-run | --apply] [--repo owner/name]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const EnvSchema = z.object({
  LINEAR_API_KEY: z.string().min(1).optional(),
  LINEAR_TEAM_KEY: z.string().min(1).optional(),
});

/** Reads `.env.linear` from the repo root, or the file named by LINEAR_ENV (read-only; never committed). */
function loadEnv(): { env: z.infer<typeof EnvSchema>; file: string } {
  const file = path.resolve(process.cwd(), process.env.LINEAR_ENV ?? '.env.linear');
  loadDotenv({ path: file, quiet: true });
  return { env: EnvSchema.parse({ LINEAR_API_KEY: process.env.LINEAR_API_KEY, LINEAR_TEAM_KEY: process.env.LINEAR_TEAM_KEY }), file };
}

const log = (line = '') => console.log(line);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { env, file } = loadEnv();
  const repo = args.repo ?? detectRepo();

  log(`Config file: ${file}${env.LINEAR_API_KEY ? '' : ' (not found or no LINEAR_API_KEY)'}`);
  log(`GitHub repo: ${repo} (read-only via gh)`);
  const issues = listGitHubIssues(repo);
  const desired = issues.map(toDesired);
  log(`GitHub issues read: ${issues.length} (${issues.filter((i) => i.state === 'OPEN').length} open, ${issues.filter((i) => i.state === 'CLOSED').length} closed)`);

  if (!env.LINEAR_API_KEY) {
    if (args.apply) throw new Error('--apply needs LINEAR_API_KEY in .env.linear (see .env.linear.example).');
    log('Mode: DRY-RUN (offline). LINEAR_API_KEY is not set, so the Linear side is unknown; every issue is shown as a create.');
    log(`Team key: ${env.LINEAR_TEAM_KEY ?? '(unset; LINEAR_TEAM_KEY needed for --apply)'}`);
    log();
    log(summarizePlan(planChanges(desired, [])));
    return;
  }
  if (!env.LINEAR_TEAM_KEY) throw new Error('LINEAR_TEAM_KEY is required when LINEAR_API_KEY is set.');

  const client = new LinearClient(env.LINEAR_API_KEY);
  const viewer = await client.viewer();
  const team = await client.teamByKey(env.LINEAR_TEAM_KEY);
  log(`Linear: acting as ${viewer.name} <${viewer.email}>, team ${team.key} (${team.name})`);

  const [states, labels, existing] = await Promise.all([
    client.workflowStates(team.id),
    client.labels(team.id),
    client.mirroredIssues(team.id, MARKER_PREFIX),
  ]);
  log(`Linear issues already carrying a ${MARKER_PREFIX} marker: ${existing.length}`);

  const stateFor = new Map<LinearStateName, LinearWorkflowState>();
  for (const name of Object.keys(STATE_FALLBACK_TYPE) as LinearStateName[]) {
    const { state, note } = resolveState(states, name, STATE_FALLBACK_TYPE[name]);
    if (note) log(`WARN ${note}`);
    stateFor.set(name, state);
  }

  const plan = planChanges(desired, existing);
  const missingLabels = [...new Set(desired.flatMap((d) => d.labels))].filter((n) => !labels.some((l) => l.name === n)).sort();
  log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN (live diff)'}`);
  if (missingLabels.length) log(`Labels to create in team ${team.key}: ${missingLabels.join(', ')}`);
  log();
  log(summarizePlan(plan));
  if (!args.apply) return;

  const labelIndex = new Map(labels.map((l) => [l.name, l] as const));
  for (const name of missingLabels) {
    const created: LinearLabel = await client.createLabel(team.id, name);
    labelIndex.set(name, created);
    log(`created label ${name}`);
  }
  const labelIds = (d: DesiredIssue) =>
    d.labels.map((n) => {
      const l = labelIndex.get(n);
      if (!l) throw new Error(`label ${n} missing after creation`);
      return l.id;
    });
  const stateId = (d: DesiredIssue) => {
    const s = stateFor.get(d.stateName);
    if (!s) throw new Error(`state ${d.stateName} unresolved`);
    return s.id;
  };

  let created = 0;
  let updated = 0;
  for (const item of plan satisfies readonly PlanItem[]) {
    const d = item.desired;
    const attachmentTitle = `GitHub #${d.githubNumber}`;
    if (item.kind === 'create') {
      const issue = await client.createIssue({
        teamId: team.id,
        title: d.title,
        description: d.description,
        stateId: stateId(d),
        priority: d.priority,
        labelIds: labelIds(d),
      });
      await client.attachUrl(issue.id, d.githubUrl, attachmentTitle);
      created += 1;
      log(`created ${issue.identifier} ← #${d.githubNumber} ${issue.url}`);
    } else if (item.kind === 'update') {
      await client.updateIssue(item.existing.id, {
        title: d.title,
        description: d.description,
        stateId: stateId(d),
        priority: d.priority,
        labelIds: labelIds(d),
      });
      if (!item.existing.attachmentUrls.includes(d.githubUrl)) await client.attachUrl(item.existing.id, d.githubUrl, attachmentTitle);
      updated += 1;
      log(`updated ${item.existing.identifier} ← #${d.githubNumber} (${item.changes.join('; ')})`);
    }
  }
  log();
  log(`Applied: ${created} created, ${updated} updated. GitHub was not modified.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
