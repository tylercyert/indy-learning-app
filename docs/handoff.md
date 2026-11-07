# Current handoff

## State on 2026-11-07 (end of day; `main` at `ecaf7b5`)

Slices 1–5 of `docs/implementation-plan.md` are merged to `main`. The tracker is GitHub Issues (milestone "First complete learning loop"); this document is a snapshot of what a stranger would find, not the tracker. A Linear mirror was tried and removed the same day (#25, #27): there is no second tracker.

**What is on `main`, by merge:**

- `41d745b` slice 1 foundation (#1): contracts, domain rules, server skeleton, router shell.
- PR #19 slice 2 (#2): intake (≤ 4 questions), planning, on-demand and prefetched learning experiences, events with deterministic scoring, completion, streak; home, intake chat, course screen with circle nodes on a winding path, lesson player, celebration; web app served by the API server under one origin; Playwright journey driver and `/dev/slide` harness; QA round 1 fixes (#13–#15, #17).
- PR #22 slices 4+5 (#4, #5) and the rest of slice 3 (#3): learning history into generation context, companion rename/re-roll, additional skill trees ("keep going" / "explore"), course discovery with a public projection and cloning, predictive prefetch so the first lesson is Ready on arrival, diagram renderer rework and tightened content bounds (#16).
- PR #26 QA follow-ups (#20): earlier skill trees visible, quick answers under the last question, confetti (reduced-motion aware) and haptics, persistent live region, rule tolerance.
- PR #30 (#29): lock hardening (every experience read and event re-checks node availability, 409 when locked), no pre-completed nodes on new courses, Anthropic fast mode on generation, ratio-bar bounds.
- PR #32 (#31): Goal Screening on `claude-haiku-5-5` before the first intake question and again before planning; refusal is a 422 the companion speaks.
- PR #34 (#23 batches 1–2, #33): component hardening (9 render defects, 200% text support, callout and ratio bounds, stress fixtures regenerated from contract constants) and two new components, `codeBlock` and `fillBlank`, with server-side deterministic scoring wired into the lesson player. PR #28 was closed as superseded by #34.

**What the demo does today.** At http://100.75.97.3:8787 (tailnet, see below) a learner types a goal, is screened, answers up to four intake questions, and gets a course whose orientation lesson is already written when the course screen appears. The skill tree is a winding path of circles with derived locked / available / completed states, a companion at the next node and node-level "Writing… / Ready" states. Lessons play slides from the eight-component catalog (text, callout, ratioBar, diagram, checklist, multipleChoice, codeBlock, fillBlank); wrong answers teach and allow retries; completion brings confetti, the streak and the next unlocked node; a finished course offers "Keep going" (a new tree) and "Learn something different" (exploration through intake). Home shows the streak, the learner's courses and a Discover section of other learners' courses.

**Evidence on `main`:** `npm run verify` (typecheck, lint with zero warnings, 123 vitest tests in 7 files; re-run on `ecaf7b5` for this audit) and `npm run export:all` (PR #34) pass. Live checks: `server/scripts/smoke.ts` (full loop against the real API), `server/scripts/screen-smoke.ts` (Goal Screening, 9/9), headless phone/tablet/desktop journeys under `qa/`. Phone journey to course + first lesson: about 49 s with fast mode (was ~60 s).

**Not verified, honestly:** no real device has run the app (Expo Go on iPhone/iPad is #9, owners' job); text scaling is emulated on web only; VoiceOver/TalkBack untested; fast-mode fallback under a real 429 not exercised; the lock bypass in #29 was hardened defensively without a headless reproduction.

**In progress right now:** #35 branching skill-path layout (branch `agent/claude/35-branching-path`, main session). #36 UI/UX audit against the Duolingo bar (phone first). #23 component-hardening lane stays open for `matchPairs` and further stress passes. #20 holds the deferred QA items (keyboard Space/arrows on options, focus-to-heading, two-column course on wide screens, celebration recap line).

## Models and structured outputs (issue #7, resolved by documentation)

Generation runs on `claude-opus-5-5` with adaptive thinking and per-task effort, in Anthropic fast mode by default (`ANTHROPIC_FAST_MODE`, `0` disables; on a 429 or an unsupported-speed 400 the process falls back to standard speed and stays there). Intake turns stay on standard speed. Goal Screening runs on `claude-haiku-5-5` (`server/src/services/screening.ts`) and fails closed.

The API compiles output schemas to a grammar with limits: no `oneOf`, at most 24 optional and 16 union-typed properties, no `$defs` under `anyOf`, and a size cap the slide schema exceeds. `server/src/ai/output-format.ts` reshapes schemas (oneOf→anyOf, every property required, constraints stripped), and `server/src/ai/claude.ts` falls back to prompt-guided JSON when the API rejects a schema, remembering the mode per schema. Full Zod validation and one issue-fed retry run in both modes. Today planning uses grammar mode; intake and slides use prompt mode. Validation retries are logged with `console.warn` on the server; there is no failure-rate counter yet.

The mockup that drives the UI is a Design artifact (link in the owners' session; ask Tyler). It shows home, intake, skill path, slides, correction, application question, celebration and the companion system.

## QA tooling (`qa/`, outputs in gitignored `qa/out/`)

`npm run qa:journey [goal]` drives a full generated journey headlessly and saves screenshots; `npx tsx qa/discover.ts` and `npx tsx qa/explore.ts` check discovery and the exploration path; `npm run qa:slides` renders the stress fixtures in `qa/fixtures/stress/` through `/dev/slide` (`QA_TEXT_SCALE=2` for 200% text; `generate.ts` regenerates the fixtures from the contract constants); `npx tsx qa/a11y/audit.ts` runs axe-core plus keyboard passes (`QA_SKIP_INTAKE=1` avoids the model call). All need the server running on :8787 (`QA_BASE_URL` to override).

## Run on Noir and open over Tailscale

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
alias n24='npm exec --yes --package=node@24 --'
cd ~/projects/indy-learning-app
n24 npm ci
cp server/.env.example server/.env            # then set ANTHROPIC_API_KEY
printf 'EXPO_PUBLIC_API_URL=http://%s:8787\n' "$(tailscale ip -4)" > .env.local
```

**Stable URL for laptops and phones on the tailnet** (exported web app served by the API server, same origin):

```sh
n24 npm run serve        # expo export --platform web, then the API server on 0.0.0.0:8787
# open http://100.75.97.3:8787 in any browser on the tailnet
```

Re-run `n24 npm run web:export` after client changes; the server picks up `dist/` on restart. All API routes live under `/api/`; the web app owns the root and deep links fall back to `index.html`.

**Dev server with hot reload** (Metro advertised on the Tailscale IP, also for Expo Go):

```sh
n24 npm run start:tailscale        # Metro on :8081, QR and URLs use the tailscale IP
# web: http://100.75.97.3:8081 · phone: scan the QR in Expo Go (SDK 58)
```

Use a unique Metro port per workspace. `ALLOW_NO_AI=1` runs the server without a key for non-generation work. If a tailnet device cannot reach :8787 or :8081, Noir's firewall is blocking the `tailscale0` interface; an admin can trust it with `sudo firewall-cmd --zone=trusted --add-interface=tailscale0 --permanent && sudo firewall-cmd --reload` (verified from Noir itself only; the firewall was not checked because that needs sudo).

## What is deliberately not configured

No Supabase, EAS, hosting, CI runners, branch protections, analytics or store signing. The only spend is the Anthropic API key, which lives in `server/.env` and nowhere else. Social features are pending.

## Open items (each has an issue)

- #9 device QA on iPhone and iPad via Expo Go: not done; owners' job.
- #35 branching skill-path layout from the mockup: in progress.
- #23 component-hardening lane: `matchPairs` proposal held; interaction-state renders at 200% are the next stress pass.
- #20 deferred QA: keyboard semantics on options, focus management, wide-screen course layout, celebration recap, optional branch required in plans with ≥ 5 nodes.
- #21 orientation lesson shape enforced at the contract (≤ 5 slides, ≤ 1 teach slide): prompt-only today.
- #8 component folder contract for sub-agents: components still live as flat files in `src/features/components/` with manifests in `src/contracts/components.ts`; the per-folder layout described in the plan is not implemented.
- #10 `npm audit`: 12 moderate advisories via Expo/ESLint tooling (glob/minimatch). Assess exposure; do not force-downgrade Expo.
- #11 licensing of the application code is undecided; the starter's MIT notice is preserved.
- #12 hosting beyond Tailscale: undecided.
- #6 social features: blocked on the owners' brief.
- Structured-output observability (from #7): no validation-failure-rate tracking beyond server warnings; per-slide generation remains a fallback idea if prompt-mode validity drops.
