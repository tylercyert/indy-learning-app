# Current handoff

## What exists

The public repo is https://github.com/tylercyert/indy-learning-app. The source of truth is its `main` branch. The main Noir checkout is `~/projects/indy-learning-app`; Sergio has a separate worktree at `~/projects/indy-learning-app-sergio` on `agent/sergio/setup`. Keep feature agents in separate worktrees/branches. Do not move back to the old planning factory; it is not this app.

Bootstrap commit `4548ff7` provides Expo 58, React Native 0.88, strict TypeScript, a lockfile, local checks, an initial Zod preferences schema, 11 tests, issue/PR templates and these docs. The starter screen is not the finished learning journey.

## What is verified

On Noir with Node 24: `npm ci`, `npm run verify` (typecheck, lint, 11 tests) and `npm run export:all` (iOS, Android, web) passed. An independent read-only review found no blocking source/setup issue. There has been no native-device, simulator or interactive browser QA. No live provider or saved-progress implementation exists yet.

Noir's available default Node is 26.9.0. The project standard is Node 24, available without replacing the system runtime:

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
npm exec --yes --package=node@24 -- npm run verify
npm exec --yes --package=node@24 -- npm start -- --port 8082
```

Use `npm ci` inside that same Node 24 wrapper after lockfile changes. If Node 24 is already selected by a version manager, use the ordinary commands instead. Use a unique Metro port per workspace.

## What is not configured

- No autonomous agents, queue, CI runner, GitHub Actions, required checks or branch protections.
- No collaborator invitation, account provisioning, shared credentials or new access grants.
- No backend, provider secret, analytics, deployment, app-store signing or distribution.
- GitHub issue templates, labels and the first milestone exist. Starter issues have not yet been published. `docs/roadmap.md` is an unassigned work breakdown until then, not a claim of active work.

## First action for a coding session

Agree the next task and owned paths with Tyler/Sergio. Name one owner for shared lesson/tree/assessment/progress schemas before parallel UI and data work. The existing preferences seed does not yet express all agreed placement and time-horizon choices; finish that contract before building consumers. Implement one complete learning loop before widening scope.

## Open decisions and risks

- Exact name/brand and gamification mechanics are undecided.
- Live generation requires a safe credential boundary; fixture mode first, clearly labeled.
- PR/main automation needs a runner/cost/access decision; local verification is available now.
- `npm audit` at bootstrap reported 12 moderate advisories, no high/critical. They trace to glob/minimatch through Expo tooling and TypeScript ESLint tooling. Assess actual exposure and compatible patches; do not blindly force-downgrade Expo. See `docs/quality.md`.
- The starter's MIT notice is preserved. Clarify the original app's license and notice scope with the owner before wider distribution.
