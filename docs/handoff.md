# Current handoff

## State on 2026-11-07

Slice 1 (foundation) is merged to `main` (`41d745b`, issue #1). Slice 2 (first complete loop, issue #2) is on branch `agent/claude/2-first-loop`: intake, planning, on-demand experience generation, events with deterministic scoring and completion, and the client screens (home, intake chat, course, lesson player with all six components, celebration). `npm run verify` (62 tests) and `npm run export:all` pass.

**Live end-to-end verified** with the real API via `server/scripts/smoke.ts`: goal → 3 intake questions → 5-node plan with companion → 6-slide orientation lesson (diagram, two multiple-choice checks, checklist) → wrong answers teach, right answers score → completion → streak 1 → next node unlocked. About 60 seconds wall clock. Device QA on phones is issue #9 and has not been done.

Work tracking lives in GitHub Issues (#1–#12, milestone "First complete learning loop"). Update the issue when a slice lands; this document is a snapshot, not the tracker.

## Structured outputs: what the live API taught us (issue #7)

The API compiles output schemas to a grammar with limits: no `oneOf`, at most 24 optional and 16 union-typed properties, no `$defs` under `anyOf`, and a size cap the slide schema exceeds. `server/src/ai/output-format.ts` reshapes schemas (oneOf→anyOf, every property required, constraints stripped), and `server/src/ai/claude.ts` falls back to prompt-guided JSON when the API rejects a schema, remembering the mode per schema. Full Zod validation and one issue-fed retry run in both modes. Today planning uses grammar mode; intake and slides use prompt mode.

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
