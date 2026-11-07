# Indy Learning

Learn anything, for a real reason. A learner states a goal, a short conversation gathers context, and the platform generates a personalized course as a skill tree of reusable lessons delivered as typed, interactive slides. Expo + TypeScript client; Hono + SQLite API server in this repo; Claude for generation behind validated contracts.

**Status:** slice 1 (foundation) complete; first end-to-end learning loop is slice 2. See `docs/implementation-plan.md`.

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
npm run server:dev                        # API on :8787
npm run web                               # or: npm start, then Expo Go
npm run verify                            # typecheck, lint, tests
npm run export:all                        # iOS, Android, web bundles
```

## Layout

- `app/`: Expo Router file routes
- `src/contracts/`: Zod contracts shared by client and server; types inferred, never copied
- `src/domain/`: pure rules: progression, scoring, completion, streak
- `src/features/`: screens and component renderers
- `src/services/`: the API client
- `server/src/`: Hono routes, services, the only model caller (`ai/`), Drizzle + SQLite (`db/`)
- `server/drizzle/`: generated SQL migrations
- `docs/`: product, architecture, plan, decisions, handoff

## Privacy and licensing

The repository is public for the competition. Nothing paid is configured. The application code license is undecided; `LICENSE` preserves the Expo starter's MIT notice.
