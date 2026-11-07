# Implementation plan

Vertical slices, each ending in something a learner can do. Contracts in `src/contracts` are stable from slice 1; later slices add fields with new `schemaVersion`s, never silent changes. Vocabulary: `CONTEXT.md`. Decisions: `docs/decisions/`.

## Architecture in one screen

```text
Expo app (iOS / iPad / Android / web)          server/ (Hono, Node 24, this repo)
  app/            file routes (Expo Router)      src/routes/     HTTP API, bearer auth
  src/features/   screens + component renderers  src/services/   intake, planning, generation, progress
  src/services/   api client (fetch + token)     src/ai/         the ONLY model caller; structured outputs
  src/domain/     pure rules (shared)            src/db/         Drizzle + SQLite, JSON documents + indexes
  src/contracts/  Zod contracts (shared)   <---- both sides import the same schemas
```

- The model returns structured output against a contract; the server validates with the same contract, then stores.
- Scoring, progression, completion and streaks are pure functions in `src/domain`, tested without I/O.
- Node state (locked / available / completed) is derived from lesson completions every time; it is never stored.

## Slice 1 — foundation (done 2026-11-07)

Contracts for rich text, six components, slides, lessons, learning experiences, skill trees with `allOf` / `anyOf` / `atLeast` rules, courses, learner context, learning history, companion, intake turn and course plan. Domain rules with tests. Server skeleton: env validation, SQLite schema and migration, health, anonymous learner bootstrap, bearer auth. Claude client with structured output, validation and one issue-fed retry. Expo Router shell. `npm run verify` and `npm run export:all` pass.

## Slice 2 — first complete loop (server live-verified 2026-11-07; device QA pending, issue #2)

Learner types a goal → intake conversation (companion asks only what it needs, max 4 questions) → course plan → orientation lesson generated → learner completes it → celebration.

- Server: `POST /intake`, `POST /intake/:id/reply`, `POST /courses` (from a ready intake), `GET /courses/:id`, `POST /courses/:id/nodes/:nodeId/experience`, `POST /experiences/:id/events`, completion detection.
- Generation context assembly: learner context + plan + component manifests + contract examples; no raw history dump.
- Client: home input, intake chat screen, generating state with companion, slide renderer for the six components, completion screen.
- Acceptance: a real goal in any subject produces a plan and a playable orientation lesson on web and on a phone via Expo Go, with validation failures handled (retry, then a clear error, never a blank screen).

## Slice 3 — the skill tree (shipped with #19/#22; polish on #3)

Winding-path tree of circles from derived node states; prefetch states (Ready / Writing…); course completion with "keep going"; streak; celebration screen; companion moods. Remaining: celebration animation polish.

## Slice 4 — learning history into generation (PR #22)

`LearningSummaryV1` built from events (completed lessons, struggles, strengths) and included in planning and lesson prompts; lesson reuse offered by subject; companion rename and re-roll (`PATCH /api/courses/:id/companion`); additional skill trees (`POST /api/courses/:id/trees`, continue or explore) that reopen a completed course without touching prior trees.

## Slice 5 — discovery and exploration (PR #22)

`GET /api/discover` returns a public projection (never a learner's context); `POST /api/discover/:id/start` clones the skill trees for the new learner so completions are recognized; exploration requests start an intake inside a course and add a tree. Home has a Discover section; the course screen has "Learn something different".

## Waiting, by decision (2026-11-07)

Course creation awaits the orientation lesson so the first node is Ready on arrival; opening a lesson pre-writes the lessons it will unlock (predictive prefetch from the progression rules); completion also prefetches. The beaker animation is only for course creation; opening a node shows the spinner in the node.

## Slice 6 — social

Pending the owners' brief. The learner, course and history models carry stable ids and no assumptions about relationships.

## Component sub-agents (after slice 2)

A component is one folder: `schema.ts` (props + result), `Component.tsx` (renderer), `manifest.ts` (role, when to use), `*.test.ts`. The registry collects manifests and the generation context lists them. A sub-agent adds a folder and registers it; nothing else changes.

## Running

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH      # Noir: Node 24 wrapper
alias n24='npm exec --yes --package=node@24 --'
n24 npm ci
cp server/.env.example server/.env   # fill ANTHROPIC_API_KEY
printf 'EXPO_PUBLIC_API_URL=http://%s:8787\n' "$(tailscale ip -4)" > .env.local
n24 npm run server:dev               # http://0.0.0.0:8787
n24 npm start -- --port 8081         # Expo Go / web
n24 npm run verify && n24 npm run export:all
```

`ALLOW_NO_AI=1` boots the server without a key for schema and UI work; generation routes return 503.
