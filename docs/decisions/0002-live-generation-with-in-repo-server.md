# 0002: Live generation through an in-repo API server, typed content, zero paid infrastructure

Date: 2026-11-07. Status: accepted. Supersedes the fixture-first and single-screen guidance in 0001 and the earlier product/architecture docs.

The owners decided to build the complete platform during the hackathon with real AI generation, and to pay for nothing except the Anthropic API key. So: a TypeScript API server lives in this repository (`server/`, Hono) and is the only process that holds the key or talks to the model; the Expo client talks only to that server. Data is a local SQLite file through Drizzle ORM so a later move to Postgres is a driver change, not a schema rewrite. Identity is a server-issued anonymous learner token, upgradeable later without migration.

## Considered options

- Supabase (Postgres, Auth, Edge Functions) — rejected for cost, and because edge-function time limits fit poorly with long streaming generations.
- Key in the Expo client via `EXPO_PUBLIC_*` — rejected; it would ship the secret in the bundle.
- Fixture-only demo — rejected by the owners; the goal is a working product.

## Consequences

- Every generated document (intake turn, course plan, slides, companion) is requested as structured output against a Zod contract in `src/contracts` and validated by that same contract before storage. The model's output is data: never markup, never code.
- Slides are typed JSON composed from a closed component catalog; there is no generated HTML anywhere.
- Lesson identity is independent of courses; completion is recognized across courses; node state is derived, never stored.
- Phones reach the server over Tailscale or LAN during the hackathon; hosting is a separate, later decision.
