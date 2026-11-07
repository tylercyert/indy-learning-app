# Linear as a mirror board

GitHub Issues are the single record for scope, status, ownership and discussion (`docs/factory.md`).
Linear exists only so the owners can see the work as a board. Nothing is created or edited in
Linear by hand; a change typed in Linear is not a change to the project. Zero spend: the Linear
Free plan only (unlimited members, 250 issues, integrations and API included as of 2026-11-07,
https://linear.app/pricing).

## Recommendation

Use the small mirror script in `scripts/linear/` (`npm run linear:sync`) rather than Linear's
native GitHub Issues Sync. Reasons, from the research below:

1. The native sync maps GitHub state only as open/closed. Our board columns are the `status:*`
   labels (backlog, ready, in-progress, review, blocked); the script maps those to Linear workflow
   states and `priority:*` to Linear priority. Native sync would put every open issue in one column
   with the status as a plain label.
2. Native sync "will only sync newly created issues". The 20-plus existing issues would need the
   separate importer (Linear admin, a second GitHub app install, GitHub org/repo admin), and the
   importer enables bidirectional sync by default, which contradicts "GitHub is the record".
3. Two-way sync is a second place to type. The script is strictly one-way: it reads GitHub through
   the `gh` CLI and writes only to Linear. Idempotent re-runs make Linear converge on GitHub.
4. No GitHub App installation on the repository and no workspace-wide integration setup is needed;
   one personal API key in a gitignored file is enough.

The native integration stays an optional add-on later for PR/branch linking (it does not conflict
with the mirror). If the owners later prefer it, choose **one-way** sync (GitHub → Linear) and keep
the rule that work is created on GitHub.

## Research notes (fetched 2026-11-07)

### Native GitHub integration — https://linear.app/docs/github

- Two features: PR/commit linking, and **GitHub Issues Sync**. Issues Sync is per repository →
  Linear team, either one-way (GitHub creates a copy in Linear) or two-way. Only one repo can be
  two-way at a time.
- Requirements: the GitHub app "must be installed by a GitHub organization owner"; for a single
  repository a repository administrator can install it with repo-only access. Set up in Linear
  Settings → Integrations → GitHub → Enable → choose repos → Install; then "GitHub Issues" → "+" →
  pick repo and team. Each member connects their own GitHub account for assignee/comment mapping.
- Synced fields: title, description, status (open/closed; GitHub Project custom statuses do not
  sync), assignee, labels, sub-issues, comments in the synced thread, priority.
- Limitation: "GitHub Issues Sync will only sync newly created issues." Existing issues go through
  the importer (https://linear.app/docs/github-to-linear): Linear admin only, installs the Linear
  Data importer GitHub app, imports title/description/labels/comments/assignees, maps open/closed
  to states, closed issues optionally into the archive, and syncs bidirectionally afterwards unless
  switched off in the import flow.
- Plan: the docs do not gate the GitHub.com integration behind a paid plan; the pricing page lists
  "Integrations: Included" and "API and webhook access: Included" on Free. Enterprise is only needed
  for GitHub Enterprise Cloud/Server.

### GraphQL API — https://linear.app/developers/graphql

- Endpoint `https://api.linear.app/graphql`. Personal API key goes in the header as
  `Authorization: <API_KEY>` (no `Bearer`; OAuth tokens use `Bearer`).
- Create a key: Settings → Account → Security & access → Personal API keys
  (https://linear.app/docs/api-and-webhooks). Keys can be full access or restricted to Read /
  Write / Admin / Create issues / Create comments and limited to specific teams. Admins can disable
  member key creation.
- Team id: `query { teams { nodes { id key name } } }`; the script filters by key
  (`teams(filter: { key: { eq: "IND" } })`).
- Create/update: `issueCreate(input: IssueCreateInput!)` with `teamId`, `title`, `description`
  (markdown), `stateId`, `priority`, `labelIds`; `issueUpdate(id: String!, input: IssueUpdateInput!)`
  with any subset. Omitting `stateId` on create puts the issue in the team's first Backlog state.
- Priority (schema description): `0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low`.
- Workflow states: `workflowStates(filter: { team: { id: { eq } } }) { nodes { id name type position } }`;
  `type` is one of `triage, backlog, unstarted, started, completed, canceled, duplicate`.
- Labels: `issueLabels(filter: ...)` and `issueLabelCreate(input: { name, teamId })` (omit `teamId`
  for a workspace label).
- Filtering (https://linear.app/developers/filtering): string comparators include `eq`, `contains`,
  `containsIgnoreCase`, `startsWith`; filters combine with AND, `or: [...]` for OR. `IssueFilter`
  has `description: NullableStringComparator`, `team: TeamFilter`, `labels`, `state`.
- Attachments (https://linear.app/developers/attachments): `attachmentCreate(input: { issueId, url,
  title, subtitle?, metadata? })`. "Attachment URL is used as an idempotent value if used in
  conjunction with the same issue id", so re-attaching the GitHub URL updates rather than
  duplicates. `attachmentsForURL(url:)` finds issues by the URL.
- Pagination (https://linear.app/developers/pagination): Relay style, `first`/`after`,
  `pageInfo { hasNextPage endCursor }`, default 50 per page.
- Rate limits (https://linear.app/developers/rate-limiting): personal keys 2,500 requests/hour and
  3,000,000 complexity points/hour, with `X-RateLimit-Requests-Remaining` etc. headers. A full sync
  of this repo is a few dozen requests.
- Input/filter field names above were confirmed by unauthenticated schema introspection against the
  endpoint on 2026-11-07 (the scratch script is not committed).

## How the mirror works

`scripts/linear/sync.ts` (run with `npm run linear:sync`):

1. Reads every issue, open and closed, with `gh issue list --state all --json ...` (read-only; the
   `gh` login is the only GitHub credential). Pull requests are excluded.
2. Maps each issue (`scripts/linear/mapping.ts`, unit-tested in `mapping.test.ts`):
   - `status:backlog` → Backlog, `status:ready` → Todo, `status:in-progress` → In Progress,
     `status:review` → In Review, `status:blocked` → Todo plus label `blocked`; closed → Done.
     An open issue without a status label lands in Backlog.
   - `priority:p0/p1/p2` → Linear priority 1/2/3; none → 0.
   - `area:*` labels → Linear labels of the same name (created in the team when missing).
   - Description = marker line `github:#<number> sync:<fingerprint>`, a "mirrored from" link, the
     milestone, then the GitHub body. The number is the idempotency key; the fingerprint (first 12
     hex chars of a SHA-256 over the generated text) is how a re-run detects body/milestone
     changes, because Linear re-serializes stored markdown (autolinks, `*` bullets, escaping) and
     the text itself never compares equal.
3. Fetches the team's issues whose description contains `github:#`, indexes them by marker, and
   plans create / update / unchanged per GitHub issue. It never deletes a Linear issue and never
   writes to GitHub.
4. Attaches the GitHub issue URL as a Linear attachment (idempotent per issue).
5. Resolves target states by name; if a team lacks e.g. "In Review" it falls back to the first
   state of the matching type and prints a warning. Add the missing state in Team settings →
   Workflow for an exact column.

Modes: dry-run is the default and is forced when `LINEAR_API_KEY` is missing (offline plan: every
issue shows as a create because the Linear side is unknown). With a key, dry-run shows a live diff.
`--apply` performs the writes. Flags: `--repo owner/name` (default: the current repo via `gh`),
`--team KEY` (overrides `LINEAR_TEAM_KEY`). `LINEAR_ENV=/path/to/.env.linear` reads the config
from another checkout, read-only.

## Owner setup (two manual steps, Free plan)

1. **Workspace and team.** Sign in at https://linear.app, create a workspace on the Free plan (no
   paid add-ons, no trial upgrade), invite collaborators, and create or pick one team for this
   project. Note the team **key** shown in Settings → Teams (the prefix of issue identifiers; the
   owners' workspace uses `YERB`, team "Yerba Mate"). Optional but recommended: Team settings →
   Workflow → add a status named `In Review` of type Started so the review column exists (YERB
   already has one).
2. **Personal API key, saved locally only.** In Linear: Settings → Account → Security & access →
   Personal API keys → create a key (Write access, limited to that team is sufficient). Then, from
   the repo root, write it to the gitignored file in one step (replace the two values):

   ```sh
   printf 'LINEAR_API_KEY=%s\nLINEAR_TEAM_KEY=%s\n' 'lin_api_...' 'YERB' > .env.linear && chmod 600 .env.linear && git check-ignore -q .env.linear && echo ok
   ```

   `ok` confirms the file is ignored. Never paste the key into an issue, PR, chat log or
   `EXPO_PUBLIC_*` variable.

## Running the sync

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
npm exec --yes --package=node@24 -- npm run linear:sync             # dry-run: live diff
npm exec --yes --package=node@24 -- npm run linear:sync -- --apply  # write to Linear
```

Run it after changing labels or closing issues on GitHub, or on a schedule the owners choose
later (no CI runner exists; see `docs/factory.md`). The Free plan caps a workspace at 250 issues;
the script mirrors closed issues too, so archive Done issues in Linear if the cap approaches.

## Verification status (2026-11-07)

`--apply` was run once against the owners' workspace (team `YERB`) from the #24 branch: 6 labels and
22 issues (YERB-5 … YERB-26) were created, GitHub was not modified, and a read-only API check of six
issues confirmed title, state, priority, labels, marker line and the GitHub attachment. A second
apply rewrote descriptions once to add the `sync:` fingerprint; after that a dry-run reports every
issue unchanged. Not verified: label *removal* on an existing Linear issue, title edits, and a run
near the Free plan's 250-issue cap.
