# Implementation plan

Vertical slices, each ending in something a learner can do. Contracts in `src/contracts` are stable from slice 1; later slices add fields with new `schemaVersion`s, never silent changes. Vocabulary: `CONTEXT.md`. Decisions: `docs/decisions/`.

**Status audit 2026-11-07 (`main` at `ecaf7b5`):** slices 1–5 are merged (#1, PR #19, PR #22, PR #26); slice 6 is blocked on the owners' brief (#6). Since the slices landed, `main` also gained lock hardening and Anthropic fast mode (PR #30, #29), Goal Screening (PR #32, #31) and the component-hardening lane with `codeBlock` and `fillBlank` (PR #34, #23, #33). The plan text below is kept as written; each slice heading carries its status and evidence. Where the text says "six components" it describes the catalog at the time; the catalog is eight today (`src/contracts/components.ts`).

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

## Slice 1 — foundation (done 2026-11-07, `41d745b`, #1 closed)

Contracts for rich text, six components, slides, lessons, learning experiences, skill trees with `allOf` / `anyOf` / `atLeast` rules, courses, learner context, learning history, companion, intake turn and course plan. Domain rules with tests. Server skeleton: env validation, SQLite schema and migration, health, anonymous learner bootstrap, bearer auth. Claude client with structured output, validation and one issue-fed retry. Expo Router shell. `npm run verify` and `npm run export:all` pass.

## Slice 2 — first complete loop (done: merged in PR #19, #2 closed; the "on a phone via Expo Go" half of the acceptance is still open as #9)

Learner types a goal → intake conversation (companion asks only what it needs, max 4 questions) → course plan → orientation lesson generated → learner completes it → celebration.

- Server: `POST /intake`, `POST /intake/:id/reply`, `POST /courses` (from a ready intake), `GET /courses/:id`, `POST /courses/:id/nodes/:nodeId/experience`, `POST /experiences/:id/events`, completion detection.
- Generation context assembly: learner context + plan + component manifests + contract examples; no raw history dump.
- Client: home input, intake chat screen, generating state with companion, slide renderer for the six components, completion screen.
- Acceptance: a real goal in any subject produces a plan and a playable orientation lesson on web and on a phone via Expo Go, with validation failures handled (retry, then a clear error, never a blank screen).

## Slice 3 — the skill tree (done: PR #19, #22 and #26; #3 closed by the status audit)

Winding-path tree of circles from derived node states; prefetch states (Ready / Writing…); course completion with "keep going"; streak; celebration screen; companion moods. Celebration polish (reanimated confetti honoring reduced motion, haptics on native) landed in PR #26. Of the five acceptance boxes on #3, four are done; "Device QA on iPhone and iPad layouts" is not and lives on #9. The mockup's branching layout (a node forking into two side-by-side paths, optional branches dead-ending) is #35, in progress.

## Slice 4 — learning history into generation (done: PR #22 merged, #4 closed)

`LearningSummaryV1` built from events (completed lessons, struggles, strengths) and included in planning and lesson prompts; lesson reuse offered by subject; companion rename and re-roll (`PATCH /api/courses/:id/companion`); additional skill trees (`POST /api/courses/:id/trees`, continue or explore) that reopen a completed course without touching prior trees.

## Slice 5 — discovery and exploration (done: PR #22 merged, #5 closed)

`GET /api/discover` returns a public projection (never a learner's context); `POST /api/discover/:id/start` clones the skill trees for the new learner so completions are recognized; exploration requests start an intake inside a course and add a tree. Home has a Discover section; the course screen has "Learn something different".

## Waiting, by decision (2026-11-07; done in PR #22)

Course creation awaits the orientation lesson so the first node is Ready on arrival; opening a lesson pre-writes the lessons it will unlock (predictive prefetch from the progression rules); completion also prefetches. The beaker animation is only for course creation; opening a node shows the spinner in the node.

## After the slices (merged 2026-11-07)

- **Lock hardening and fast mode (PR #30, #29):** the client sends the tree id; every experience read and event re-checks availability (409 when locked); added trees get per-tree node-id prefixes; planning never reuses a lesson the learner already completed, so a new course never shows a pre-completed node. Generation (planning, slides, companion, tree) runs in Anthropic fast mode (`ANTHROPIC_FAST_MODE`, default on, falls back to standard on 429); intake stays standard. Ratio bars are bounded (lowest terms, total ≤ 16, largest ≤ 6× smallest).
- **Goal Screening (PR #32, #31):** `claude-haiku-5-5` classifies the stated goal before the first intake question and the completed learner context before planning, validated against `GoalScreeningV1`; a refusal is a 422 the companion speaks; classifier failure fails closed.
- **Component hardening lane (PR #34, #23 batches 1–2, #33):** stress fixtures regenerated from contract constants and asserted by tests; nine render defects fixed (edge labels never lost, column gaps, proportional ratio segments, bubble tail, heading sizes, 200% text layouts, badge sizes, list markers); callout bounded to ≤ 4 blocks / ≤ 400 characters with no headings; new components `codeBlock` (presentational) and `fillBlank` (assessable, scored in `src/domain/scoring.ts` on the server, feedback in the lesson player). `matchPairs` is proposed and held.

## Slice 6 — social (blocked: owners' brief, #6)

Pending the owners' brief. The learner, course and history models carry stable ids and no assumptions about relationships.

## Component sub-agents (after slice 2; not implemented as described, see #8)

A component is one folder: `schema.ts` (props + result), `Component.tsx` (renderer), `manifest.ts` (role, when to use), `*.test.ts`. The registry collects manifests and the generation context lists them. A sub-agent adds a folder and registers it; nothing else changes.

Today the catalog is not organized this way: schemas, result schemas and manifests live together in `src/contracts/components.ts`, renderers are flat files in `src/features/components/`, and the generation prompt lists the manifests from the contracts module. The hardening lane (#23) added two components within that layout. Reorganizing into per-component folders remains the content of #8.

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

`ALLOW_NO_AI=1` boots the server without a key for schema and UI work; generation routes return 503. `ANTHROPIC_FAST_MODE=0` turns Anthropic fast mode off. For the shared demo URL and the QA scripts see `docs/handoff.md`.
