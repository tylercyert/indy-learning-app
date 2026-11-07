# Poko: Learn Anything

*Poco a poco. Learn anything.*

Tell Poko what you want to learn and why. A short chat gathers only the context that matters, and Poko builds a personal course: a winding skill path of reusable lessons, each played as interactive slides, with checks that teach when you are wrong. Expo + TypeScript client, Hono + SQLite API server in this repo, Claude for generation behind validated contracts.

## Try it

- **Live demo (tailnet):** http://100.75.97.3:8787. The API server serves the exported web app on the same origin.
- **On an iPhone:** open the URL in Safari, tap Share, then "Add to Home Screen". Poko opens full screen with its own icon and a persistent purple app bar.
- **Fresh start:** "Start over as a new learner" at the bottom of the home screen clears the device's learner.
- **Demo script and evidence map:** `docs/demo.md`.

## What a learner can do (state at submission, 2026-11-07)

- State a goal. Goal Screening refuses illegal or policy-violating goals, and Poko says why.
- Answer up to four intake questions with suggested quick answers.
- Get a course whose first lesson is already written when the skill path appears.
- Follow a winding path of required lessons, with optional side branches that dead-end. Node states (locked, available, done) are derived from completions and rules, never stored.
- Play slides from a nine-component catalog: text, callout, ratioBar, diagram, checklist, multipleChoice, codeBlock, fillBlank, matchPairs. Checks are scored by code, wrong answers explain and allow retries, and skipped checks are revisited before finishing.
- Celebrate completion, keep a streak, and see the next lesson unlock.
- Keep going with a new skill tree, explore something different, or start from a course another learner built.
- Meet a companion per course with a generated name and costume, renamed or re-rolled at will.

Social features are out of scope (#6).

## How it works

- **Contracts first.** Every model output is requested as structured output against a Zod contract in `src/contracts` and validated with that contract before storage or display. Slides are typed JSON from a closed catalog: no generated HTML, markup or code runs anywhere.
- **One process holds the key.** Only the API server talks to Anthropic. `ANTHROPIC_API_KEY` lives in `server/.env`, never in the client.
- **Models.** Generation uses `claude-opus-5-5` with adaptive thinking and fast mode, with one issue-fed retry before a clear error. Goal Screening uses `claude-haiku-5-5` and fails closed.
- **Deterministic learning rules.** Scoring, progression, completion and streaks are pure functions in `src/domain`, shared by client and server. The model never decides whether an answer is right.
- **Plan early, generate on demand.** A course plan is made at creation. Each lesson is generated when its node is opened or predicted next, using what the learner has done since.

Details: `docs/architecture.md`, `docs/decisions/`, `docs/security-notes.md`.

## How it was built

Two owners drove one shared Claude Code session, with sub-agents in their own worktrees for bounded lanes: component hardening, QA audits, companion art and the Home Screen shell. GitHub is the record. Every unit of work has an issue, every branch a PR with evidence, and nothing merged without an owner's say-so. The local gate is `npm run verify` plus headless Playwright journeys against the live server. See `docs/factory.md`, `AGENTS.md` and `docs/handoff.md`.

**Evidence at submission:** `npm run verify` passes on `main` (typecheck, lint with zero warnings, 143 tests). A full phone journey (`qa/journey.ts`) passed against the live demo after the final deploy with no console or page errors. The owners tested the Home Screen app on an iPhone 14 Pro over Tailscale.

**Not verified:** VoiceOver and TalkBack, Android, and native builds on a device (#9). Open findings from the last phone pass are #67 and #68.

## Start here

- `CONTEXT.md`: the vocabulary. Use these words.
- `docs/product.md`, `docs/architecture.md`, `docs/implementation-plan.md`, `docs/decisions/`
- `AGENTS.md`: working agreement for people and agents
- `docs/handoff.md`: current state and how to run on the shared host

## Run

Node 24 LTS. One secret: `ANTHROPIC_API_KEY`, server-side only.

```sh
npm ci
cp server/.env.example server/.env        # set ANTHROPIC_API_KEY
cp .env.example .env.local                # set EXPO_PUBLIC_API_URL to where the server is reachable
npm run server:dev                        # API on :8787 (tsx watch)
npm run web                               # or: npm start, then Expo Go
npm run verify                            # typecheck, lint, tests
npm run export:all                        # iOS, Android, web bundles
```

Server settings (`server/.env`): `ANTHROPIC_API_KEY`; `PORT` (8787); `DATABASE_PATH`; `ALLOW_NO_AI=1` boots without a key and returns 503 from generation routes; `ANTHROPIC_FAST_MODE=0` disables Anthropic fast mode (on by default).

## Scripts

| Script | What it does |
|---|---|
| `npm start` / `npm run web` / `ios` / `android` | Expo dev server (Metro), optionally opening a platform |
| `npm run start:tailscale` | Metro on :8081 advertised on the Tailscale IP, for Expo Go on phones |
| `npm run server:dev` / `server:start` | API server with reload / without |
| `npm run web:export` | `expo export --platform web` into `dist/`, which the API server serves at `/` |
| `npm run serve` | web export, then the API server on 0.0.0.0:8787 (the shared demo URL) |
| `npm run verify` | `tsc --noEmit`, `eslint --max-warnings=0`, `vitest run` |
| `npm run test` / `test:watch` | vitest once / watching |
| `npm run export:all` | Metro bundles for iOS, Android and web (bundling only, not a device test) |
| `npm run db:generate` / `db:studio` | Drizzle migration generation / Drizzle Studio |
| `npm run smoke` | live end-to-end check against the real API (`server/scripts/smoke.ts`; spends tokens) |
| `npm run qa:journey [goal]` | headless Playwright journey with screenshots in `qa/out/` (needs the server; spends tokens) |
| `npm run qa:slides` | renders the stress fixtures in `qa/fixtures/stress/` through `/dev/slide` |

Also run with `npx tsx`: `server/scripts/screen-smoke.ts` (Goal Screening), `qa/discover.ts`, `qa/explore.ts`, `qa/a11y/audit.ts` (axe-core + keyboard), `qa/shot-pwa.ts` (Home Screen shell on phone sizes), `qa/render-icons.ts` (app icons from the Poko companion), `qa/fixtures/stress/generate.ts`.

## Layout

- `app/`: Expo Router file routes
- `src/contracts/`: Zod contracts shared by client and server; types inferred, never copied
- `src/domain/`: pure rules: progression, scoring, completion, streak
- `src/features/`: screens and component renderers
- `src/services/`: the API client
- `server/src/`: Hono routes, services, the only model caller (`ai/`), Drizzle + SQLite (`db/`)
- `server/drizzle/`: generated SQL migrations
- `server/scripts/`: live smoke checks (full loop, Goal Screening)
- `qa/`: headless visual and accessibility QA drivers and stress fixtures; outputs in gitignored `qa/out/`
- `docs/`: product, architecture, plan, roadmap, decisions, handoff

## Privacy and licensing

The repository is public for the competition. Nothing paid is configured. The application code license is undecided; `LICENSE` preserves the Expo starter's MIT notice.
