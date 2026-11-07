# Poko: Learn Anything

Learn anything, for a real reason. A learner states a goal, a short conversation gathers context, and the platform generates a personalized course as a skill tree of reusable lessons delivered as typed, interactive slides. Expo + TypeScript client; Hono + SQLite API server in this repo; Claude for generation behind validated contracts.

**Status (2026-11-07):** slices 1–5 are merged: a learner states a goal, is screened, answers a short intake, gets a course whose first lesson is ready on arrival, plays slides from an eight-component catalog (text, callout, ratioBar, diagram, checklist, multipleChoice, codeBlock, fillBlank) with deterministic scoring and teaching feedback, celebrates, keeps a streak, extends a finished course or explores sideways, and can start from courses other learners built. Social features are out of scope (#6); the winding skill path with side branches is merged (#35, #51); no real device has run the app yet (#9). The tracker is GitHub Issues; `docs/handoff.md` is the current snapshot and `docs/roadmap.md` the map.

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

Also run with `npx tsx`: `server/scripts/screen-smoke.ts` (Goal Screening), `qa/discover.ts`, `qa/explore.ts`, `qa/a11y/audit.ts` (axe-core + keyboard), `qa/fixtures/stress/generate.ts`.

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
