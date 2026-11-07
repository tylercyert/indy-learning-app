# Architecture and ownership

Vocabulary lives in `CONTEXT.md`. Decisions live in `docs/decisions/`. Phases live in `docs/implementation-plan.md`.

## Shape

One npm package, two runtimes:

- **Expo app** (`app/`, `src/features`, `src/services`): presentation and the API client. Holds no secrets and no business rules.
- **API server** (`server/`): Hono on Node 24. The only process that talks to the model or the database. Holds `ANTHROPIC_API_KEY` in `server/.env`.
- **Shared** (`src/contracts`, `src/domain`): Zod contracts and pure rules imported by both sides. Types are inferred from schemas, never hand-copied.

## Contracts

`src/contracts` is owned by the shared owners' session. Every document a model returns (intake turn, course plan, slides, companion theme) is requested as structured output against a contract and validated by that same contract before anything else sees it. Every stored JSON document (course, skill tree, lesson, learning experience, history event) carries `schemaVersion` and is validated on load; plain column tables (completions, streaks, intake sessions) are versioned by migration. Breaking changes get a new version and a migration.

Hierarchy: Course → Skill Tree → Node → Lesson → Learning Experience → Slide → Component.

- Lessons have identity independent of courses. Nodes place lessons in trees. The same lesson can appear in many trees.
- Completion is per learner per lesson and is recognized in every tree that contains the lesson.
- Node state (locked / available / completed) is derived from completions and progression rules on every read. It is never stored.
- Progression rules are `allOf` / `anyOf` / `atLeast {count, of}` over node ids; every present clause must hold.

## Content and generation

Slides are typed JSON: an ordered list of components from a closed catalog (`src/contracts/components.ts`). Rich text is a structured block/inline document, https links only. No generated HTML, scripts or markup exist anywhere in the system.

Planning and generation are separate: a course plan is produced at creation; each learning experience is generated when its node is opened, so it can use what the learner has done since. Generation context is assembled per task (learner context, plan, learning summary, component manifests, contract examples); full history is never sent.

The model is `claude-opus-5-5` with adaptive thinking; effort is set per task. One retry with validation issues fed back, then a clear error. Scoring and progression never involve the model.

Goal Screening (`server/src/services/screening.ts`) runs before the first intake question and again when intake completes, on `claude-haiku-5-5` against the `GoalScreeningV1` contract. A refusal returns 422 with the companion's message and nothing is planned or stored; a classifier failure also blocks planning (fail closed).

## Data

SQLite via Drizzle (`server/src/db/schema.ts`), documents as validated JSON next to the columns we query by. Migrations are generated SQL in `server/drizzle` and applied at startup. Moving to Postgres is a driver change. Learning history is append-only events; course progress is a view over them.

## Navigation and visuals

Expo Router with file routes under `app/`. Lesson state lives in features and services, not in route files. Companion visuals are app-owned SVG parts selected by validated theme tokens. Every visual component carries a required nonvisual explanation.

## Not configured, by decision

No paid services: no Supabase, EAS, hosting or CI runners. Phones reach the server over Tailscale/LAN during the hackathon. Social features are out of scope (owner decision 2026-11-07, #6); the data model carries stable ids and no relationship assumptions.
