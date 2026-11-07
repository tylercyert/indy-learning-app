# Current handoff

## State on 2026-11-07

Slice 1 (foundation) is on branch `agent/claude/1-foundation`: contracts, domain rules with 51 tests, SQLite schema and migration, API server skeleton with anonymous learner auth, Claude client with structured output, Expo Router shell. `npm run verify` and `npm run export:all` pass. The server was smoke-tested against a scratch database (health, learner bootstrap, bearer auth, 401/404). No screen beyond the shell exists yet; slice 2 builds the first complete loop. See `docs/implementation-plan.md`.

The mockup that drives the UI is a Design artifact (link in the owners' session; ask Tyler). It shows home, intake, skill path, slides, correction, application question, celebration and the companion system.

## Run on Noir

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
alias n24='npm exec --yes --package=node@24 --'
cd ~/projects/indy-learning-app
n24 npm ci
cp server/.env.example server/.env            # then set ANTHROPIC_API_KEY
printf 'EXPO_PUBLIC_API_URL=http://%s:8787\n' "$(tailscale ip -4)" > .env.local
n24 npm run server:dev
n24 npm start -- --port 8081
```

Use a unique Metro port per workspace. `ALLOW_NO_AI=1` runs the server without a key for non-generation work.

## What is deliberately not configured

No Supabase, EAS, hosting, CI runners, branch protections, analytics or store signing. The only spend is the Anthropic API key, which lives in `server/.env` and nowhere else. Social features are pending.

## Open items

- `npm audit`: 12 moderate advisories via Expo/ESLint tooling (glob/minimatch). Assess exposure; do not force-downgrade Expo.
- Licensing of the application code is undecided; the starter's MIT notice is preserved.
- Structured-output JSON-schema support for every Zod constraint we use is to be confirmed against the live API in slice 2; the server validates with the full Zod schema regardless.
