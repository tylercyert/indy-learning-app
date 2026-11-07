# Lean app factory

## One place for each truth

- **GitHub Issues:** scope, acceptance, ownership, dependencies, blockers and current work status.
- **GitHub PRs:** changes, discussion, independent review and exact-commit verification evidence.
- **Repository docs:** durable product decisions, architecture, setup and working rules.
- **Git:** implementation history. Commit and publish authorized checkpoints rather than hiding a day's progress on one machine.

GitHub Issues remain the record. Linear is a read-only mirror for task visibility: `npm run linear:sync` (or Linear's native GitHub integration) copies issues, status labels and priorities into a Linear team board; never create or edit work in Linear only. See `docs/linear.md`. No duplicate local ticket system, custom daemon or mandatory factory-core installation.

## Lifecycle

`status:backlog` → `status:ready` → `status:in-progress` → `status:review` → closed (done). Use `status:blocked` with a specific reason and next action. Keep one status label per open issue. Use `priority:p0/p1/p2` and a small set of `area:*` labels. Limit each implementer to one active issue.

Before work, the issue states the outcome, testable acceptance criteria, scope/out-of-scope, dependencies, owned paths and verification plan. The worker comments with branch/worktree and ownership. A repo collaborator can be assigned to the issue once access is established; do not guess GitHub usernames.

## Separate workspaces

```sh
git fetch origin
git worktree add ../indy-sergio -b agent/sergio/4-learning-journey origin/main
cd ../indy-sergio
npm ci
npm start -- --port 8082
```

Replace `4-learning-journey` with the actual claimed issue. Tyler and each agent use different directories, branches and Metro ports (8081, 8082, 8083...). Sharing a machine does not mean sharing a checkout, Git identity or API credentials. A separate laptop can simply clone the same repo and create its own branch.

## Review and completion

1. Agree contracts before dependent parallel work.
2. Implement the bounded issue, update tests/docs with the code and run local checks.
3. Push the branch and open a **draft** PR linking the issue, exact SHA, checks and screenshots when useful.
4. Have an independent reviewer inspect code and acceptance behavior. Fix findings and rerun relevant checks on the changed head.
5. An authorized maintainer merges after evidence is complete. Check integrated main again; a source-branch pass is not an integrated-main pass.
6. Close the issue only when its acceptance criteria are delivered. If deferred, state what remains.

Keep bounded retries and clear escalation from factory-core. Keep human-visible decisions, review and quality gates. Leave behind permanent role hierarchies, observer loops, duplicate boards and automatic releases.

## Actual automation status

`npm run verify` and `npm run export:all` are runnable checks, not an active CI service. GitHub Actions is intentionally absent until the runner and cost model are approved. Automated PR/main execution remains an open infrastructure issue. Do not install a persistent runner or enable billed automation without approval. Branch protections and required reviews are also not enabled yet.
