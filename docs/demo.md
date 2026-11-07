# Judge-facing demo script and evidence map

Written 2026-11-07 against `main` at `ecaf7b5` (issue #43). Vocabulary is in `CONTEXT.md`. This page is a script and a map of evidence; it is not the tracker (GitHub Issues is).

The product in one sentence: a learner says what they want to learn, a short chat gathers only the context that matters, and the platform generates a personalized course as a skill tree of reusable lessons, delivered as typed interactive slides, with an assessment that teaches when the learner is wrong.

## Part 1: the 5-minute phone demo

### Before you start (not on the clock)

- Server up on Noir with the exported web app: `n24 npm run serve` (see `docs/handoff.md`). Phone on the tailnet opens `http://100.75.97.3:8787`. Check `/api/health` returns `"ai": true`.
- Fresh learner on the demo phone (clear site data or use a private tab) so Home shows the single input and nothing else.
- A second learner, prepared earlier, with a finished orientation lesson and a second skill tree already added. This is the fallback if generation is slow or the API is rate-limited; open it on a laptop tab you can switch to.
- Live generation takes real time: in the committed journeys, "Build my course" to "first lesson Ready" was 27 s to 83 s (`qa/out-v2-phone.log`, `qa/out-v4.log`) and 48.6 s with fast mode (PR #30). The script below talks through that wait; do not stand in silence.

### Script

Timings are targets. Say the quoted lines or your own version of them.

**0:00 Home (15 s).** Show the single input, "What do you want to learn?", with example chips under it.
Say: "One question. No sign-up, no catalog to browse first. The companion will ask the few things it actually needs."
Tap into the input, type a real goal, for example *"Make great cocktails for a party, with a good non-alcoholic option"*, tap **Let's go**.
Point at: nothing else competes with the input. The learner gets an anonymous server-issued token behind the scenes; no account.

**0:15 Goal Screening (10 s, invisible when it passes).**
Say: "Before the companion says a word, the goal was screened by a small fast model against the law, Anthropic's usage policy and app-store content rules. It passed, so you saw nothing. If it had failed, the companion would decline in its own voice and nothing would be stored."
Optional 20-second aside if a judge asks: back out, type *"Build a pipe bomb"*, tap **Let's go**, show the refusal text on the home screen. `server/scripts/screen-smoke.ts` runs nine such goals against the live API.

**0:25 Intake (45 s).** The companion asks one question at a time with quick-answer chips. Tap chips; type one answer by hand to show free text works.
Say: "It asks at most four questions and stops as soon as it has enough. Every turn is structured output validated against a contract: the question, the chips and the 'I have enough' signal are data, not free text we parse."
When the summary card appears ("What <companion> understood": topic, outcome, where, starting point, pace), point at the correction field: "Not right? The learner corrects it before anything is built."
Tap **Build my course**.

**1:10 Course creation (45 s, talk through the wait).** The beaker animation shows "Mixing up your course…".
Say, while it runs: "Three things happen now. The completed context is screened a second time, because an innocent goal can be steered during intake. Then Opus plans the course: a skill tree of nodes, each with one learning objective and a progression rule, reusing lessons that already exist on the platform where the objective matches. Then it writes the orientation lesson, so the first node is ready the moment you arrive. Planning and lesson generation are separate on purpose: plans are cheap and early, lessons are written when they are needed and can use what the learner has done since."
If the wait runs long, switch to the prepared laptop tab and come back later.

**1:55 Skill path (30 s).** The course screen: the companion in its generated name and costume, the streak chip, a winding path of circles.
Say: "This is the skill tree. Node state is never stored; it is derived on every read from the learner's completions and the rules on each node: all of, any of, at least N of. The first node says Start here and Ready. Dashed circles are optional branches. Core nodes continue the path."
Point at: the node tags **Ready**, **Writing…** and **Tap to write**. "Ready means the lesson is already generated. Writing means it is being generated now. The path never traps: a hard assessment gives feedback and another attempt, not a locked door."
Honesty note for the presenter: on `main` today the path winds in one lane and optional nodes are dashed; the forked side-by-side branches from the mockup are in PR #37 (issue #35, in progress). Do not promise a fork on screen unless #37 has merged.

**2:25 Lesson (75 s).** Tap the first node.
Slide 1 (text, callout): "Slides are typed JSON from a closed component catalog: text, callout, ratio bar, diagram, code block, checklist, multiple choice, fill in the blank. No generated HTML anywhere. Every visual carries a nonvisual explanation."
Advance to a diagram or ratio bar: point at the progress bar on top.
Multiple choice: **deliberately pick a wrong answer**, tap **Check**.
Say: "This is the moment we care most about. Scoring is code on the server, never the model. The explanation you see was written with the lesson, validated against the same contract, and is shown because the answer was wrong. The learner can **Check again**; a wrong answer teaches, it does not punish."
Pick the right answer, tap **Check**, show "Nice!", then **Continue** through the remaining slides. Tick a real-world checklist if one appears. Tap **Finish**.

**3:40 Celebration (20 s).** Full-bleed celebration: "Nice work!", "The next lesson on your path just unlocked", the streak.
Say: "Completion is the only lesson status. It is recorded once per learner per lesson and recognized in every course that contains the lesson. The streak counts days with at least one completion. No points, lives or leaderboards: the incentives are deliberately small."
Tap **Continue**.

**4:00 Next lesson already written (20 s).** Back on the path, the first node is Done and the next node already says **Ready**.
Say: "Opening a lesson pre-writes the lessons it will unlock, derived from the progression rules, so the learner never waits at the next node. The lesson it wrote knows what you just did: the generation context includes a learning summary built from your events."

**4:20 Learn something different (30 s).** Scroll to **Learn something different**, tap it.
Say: "At any point the learner can go somewhere different or deeper. It goes back through intake, inside the course, and adds a new skill tree. Nothing already completed is erased. Here is the second tree on the prepared learner." Switch to the laptop tab with the prepared course, show two trees; or, on the phone, answer one chip and point at "Adding a new skill tree…" and move on.
Also point at: tap the companion to **Rename** or **New look** (re-rolled costume tokens, validated), and the Discover section on Home, which starts someone else's public course for this learner with completions recognized.

**4:50 Close (10 s).**
Say: "Everything you saw was generated live, requested as structured output, validated by the same Zod contract on the server before it was stored or shown. The key never left the server. The same code path ran headless in Playwright many times today; the screenshots and logs are in the repo and on the issues."

### If something fails on stage

- Generation error with retry: the client shows an error box with **Retry**; the server already retried once with the validation issues fed back. Say so: "One retry with the issues fed back, then a clear error, never a blank screen."
- API 429 or fast mode unavailable: the server falls back to standard speed for the process and logs it; nothing to do.
- Server down: switch to the prepared laptop tab, or show the committed journey screenshots referenced on #36 and #13 to #15.

## Part 2: evidence map by judging criterion

Each row: the claim, where to look, and what is not yet true. Issue and PR numbers were checked with `gh issue view` / `gh pr view` on 2026-11-07; paths with `ls`.

### 1. Software factory and repeatability

Claim: the AI-assisted process is written down, bounded, and reusable for another project.

- **Working agreement for people and agents:** `AGENTS.md` (read-first list, GitHub-is-the-record rule, hackathon mode, quality and honesty, runtime rules, stop-and-ask). `docs/factory.md` (one place for each truth, issue lifecycle, separate worktrees, review and completion). `CONTRIBUTING.md`, `docs/onboarding.md`.
- **Vocabulary as a contract for humans and models:** `CONTEXT.md`. Domain words are the same in docs, code and prompts; "avoid" lists stop drift.
- **Subagent lanes:** `AGENTS.md` ("Sub-agents get their own worktree and branch, one bounded task, and never touch `src/contracts/**`"). Lanes that ran: #13, #14, #15 (generated journeys per subject and viewport), #16 (component stress renders), #17 (accessibility audit), #23 (continuous component hardening, PR #28 folded into PR #34), #36 (UX audit against the Duolingo bar), #38 (status audit, PR #39). Findings are comments on those issues, as the agreement requires.
- **Component recipe for a sub-agent:** `docs/implementation-plan.md` "Component sub-agents": one folder, schema + renderer + manifest + test, registered in the catalog. codeBlock and fillBlank landed that way in PR #34 (#23, #33).
- **One gate, runnable anywhere:** `npm run verify` (strict `tsc`, `eslint --max-warnings=0`, vitest; 123 tests on 2026-11-07) and `npm run export:all`. `docs/quality.md` lists the per-PR evidence expected.
- **Vertical slices with evidence on PRs:** PR #19 (slice 2 and the QA loop), #22 (slices 4 and 5), #26, #30, #32, #34; each description carries commands, counts and "not verified" lines. Roadmap in `docs/roadmap.md`.
- **Decisions that are hard to reverse get an ADR:** `docs/decisions/0001-lean-foundation.md`, `docs/decisions/0002-live-generation-with-in-repo-server.md`.
- **Tooling discipline:** a Linear mirror was tried and removed the same day as friction (#24, PRs #25 and #27). The record of why is on the issue.

Limitations: no CI runner, branch protection or required review is enabled (deliberate, `docs/factory.md` "Actual automation status"); the gate is local and trust-based. The factory has been exercised on one project by two owners and their agents; "reusable for another project" is a claim about the documents, not a second project.

### 2. Engineering quality and readiness

Claim: validated contracts at every boundary, deterministic scoring, versioned stored documents, recovery from failed generation, a key that never leaves the server.

- **Contracts at every boundary:** `src/contracts/` (Zod, types inferred, shared by client and server). Every model output is requested as structured output and validated by the same schema before storage: `server/src/ai/claude.ts` (`generateStructured`). Schema reshaping for the API's grammar limits and the prompt-mode fallback: `server/src/ai/output-format.ts`, `server/src/ai/output-format.test.ts`, issue #7, `docs/handoff.md` "Structured outputs".
- **Model output is data, never instructions:** learner text is wrapped in `<learner_input>` and declared data in every system prompt (`server/src/ai/prompts.ts`). Slides are typed JSON from a closed catalog (`src/contracts/components.ts`, `ComponentV1Schema` discriminated union); rich text is a structured document with https-only links (`src/contracts/rich-text.ts`). No generated HTML or scripts exist.
- **Deterministic scoring and progression:** `src/domain/scoring.ts` (`scoreMultipleChoice`, `scoreFillBlank`), `src/domain/progression.ts` (`deriveNodeStates`, `isRuleSatisfied`), `src/domain/completion.ts`, `src/domain/streak.ts`, tests in `src/domain/domain.test.ts`. Server-side scoring of events in `server/src/services/progress.ts` (`progress.test.ts`).
- **Lock hardening:** every experience read and event re-derives availability and returns 409 when still locked (`server/src/services/experiences.ts`, `assertExperienceOpenable`; PR #30, issue #29).
- **Goal Screening, fail closed:** `server/src/services/screening.ts`, contract `GoalScreeningV1Schema` in `src/contracts/generation.ts`, live check `server/scripts/screen-smoke.ts` (PR #32, issue #31).
- **Versioned storage:** every stored document carries `schemaVersion` and is validated on load (`src/contracts/*.ts`); SQLite via Drizzle, migrations in `server/drizzle/` applied at startup (`server/src/db/client.ts`); append-only history events, progress derived.
- **Secrets:** `ANTHROPIC_API_KEY` is read only in `server/src/env.ts` from `server/.env` (gitignored, `server/.env.example`). No `EXPO_PUBLIC_*` secret; the client holds a learner token only.
- **Failure handling:** one retry with validation issues fed back, then a typed `GenerationError` (`disabled` / `refused` / `truncated` / `invalid` / `api`) mapped to a clear client error with Retry (`server/src/routes/learning.ts`, `app/lesson/[id].tsx`). Fast-mode 429 falls back to standard speed in-process.
- **Observability:** Hono request logger; tagged server logs `[plan]`, `[tree]`, `[experience]`, `[prefetch]`, `[lock]`, `[screen]`, `[generation:<kind>]`; `/api/health` reports whether AI is on. `generatedBy` on each experience records the model (`claude-opus-5-5+fast` when fast mode was used).
- **Tests and QA evidence:** `npm run verify` (123 tests), live smoke `server/scripts/smoke.ts`, headless journeys `qa/journey.ts` (committed logs `qa/out-v2-phone.log`, `qa/out-v2-desktop.log`, `qa/out-v4.log`, `qa/out-explore-v2.log`), slide stress harness `qa/render-slide.ts` with fixtures under `qa/fixtures/stress/` and the `/dev/slide` route (`app/dev/slide.tsx`), accessibility audit `qa/a11y/audit.ts` (axe-core WCAG 2.0/2.1 A+AA plus keyboard; findings on #17), 200% text scale renders (PR #34).
- **Cost awareness:** Haiku for screening, Opus for generation; effort set per task (`low` companion and screening, `medium` intake and slides, `high` planning) and `maxTokens` capped per task; stable system prompts marked for prompt caching; fast mode is a one-line env switch (`ANTHROPIC_FAST_MODE=0`). Dependency advisories triaged in `docs/security-notes.md` (#10, #44).

Limitations: no real-device run yet (#9, Expo Go on iPhone and iPad is open); no failure-rate or latency metrics are collected, only logs (token usage is returned by `generateStructured` but not persisted or logged); a single SQLite file on one host, no backups; authentication is an anonymous bearer token with no rotation or account upgrade; CORS is `*`; no rate limiting on the API; fast mode doubles the price per token; 16 moderate `npm audit` advisories, all in dev tooling (see `docs/security-notes.md`); the orientation-lesson shape is enforced by prompt, not contract (#21).

### 3. Working application and impact

Claim: a learner can state any goal and finish a generated lesson today, on web, from a phone browser over the tailnet.

- **Live end to end:** `server/scripts/smoke.ts` (goal, intake, plan, orientation lesson, wrong and right answers, completion, streak, next node) verified 2026-11-07 (`docs/handoff.md`). Headless journeys in three subjects and three viewports: #13 (language, phone), #14 (programming, tablet), #15 (conceptual/math, desktop); mixology and sourdough logs committed under `qa/`.
- **The loop a learner can do:** home input, intake with chips and correction, course creation with the first lesson Ready on arrival, skill path with derived states, lesson player for all eight components, teaching feedback, celebration, streak, predictive prefetch of the next lesson, companion rename and re-roll, additional skill trees ("Keep going"), Discover and start another learner's course, "Learn something different" (slices 2 to 5: issues #2, #3, #4, #5; PRs #19, #22).
- **Design intent and audit:** `docs/product.md`; UX audit against the Duolingo bar with a parity scorecard, #36; P0 polish in progress on #40 and #41.
- **Impact framing:** topic-agnostic (the demo subjects were mixology, Indonesian, Python, engines, sourdough); lessons are reusable across courses so the platform gets cheaper and faster as it is used; completion carries across courses.

Limitations: web build only so far (Expo Go device QA is #9); one host behind Tailscale, no public hosting (#12); no accounts, so progress lives with the token in one browser; social features pending (#6); celebration and home "Continue" polish are open (#40).

### 4. Technical understanding

Claim: the team can explain and defend the architecture, the use of AI and the tradeoffs.

- **Architecture in one page:** `docs/architecture.md`; one screen diagram in `docs/implementation-plan.md`. Hierarchy Course → Skill Tree → Node → Lesson → Learning Experience → Slide → Component.
- **Decisions with alternatives considered:** ADR 0002 (Supabase rejected for cost and edge-function limits; key in the client rejected; fixture-only demo rejected). ADR 0001 (one app, one tracker, lightweight factory).
- **What the live API taught us:** issue #7 and `docs/handoff.md` (grammar limits: no `oneOf`, 24 optional / 16 union-typed properties, size cap; reshaping and prompt-mode fallback remembered per schema).
- **Why the model never scores or unlocks:** `src/domain/` is pure and tested; the model's outputs are content. See the judge questions below.
- **Vocabulary discipline:** `CONTEXT.md`, with "avoid" lists, used in prompts, code and issues.

Limitations: the structured-output grammar mode is used only for planning today; intake and slides run in prompt mode with full Zod validation after the fact (a documented tradeoff, not a hidden one).

### 5. Creativity and originality

- **Lessons as reusable units with identity independent of courses**, placed by nodes, with completion recognized in every tree that contains them (`CONTEXT.md` Lesson, Node, Completion; `docs/architecture.md`).
- **Plan early, generate on demand, prefetch by rule:** opening a lesson pre-writes what it unlocks, derived from `allOf` / `anyOf` / `atLeast` (`server/src/services/experiences.ts`, `docs/implementation-plan.md` "Waiting, by decision").
- **Typed slides from a closed catalog, grown by sub-agents** (eight components today; the two newest were added by a hardening lane without touching contracts' ownership).
- **A companion per course with a generated name and costume from validated theme tokens**, renameable and re-rollable (`src/features/companion/Companion.tsx`, `server/src/services/companion.ts`; headpiece and prop rendering in progress on #41).
- **Exploration that reshapes the course without erasing progress** (additional skill trees, `server/src/services/trees.ts`, `qa/explore.ts`).
- **Goal Screening spoken by the companion**, twice per course, fail closed (#31).
- **A visual QA loop driven by Playwright that reads the real app**, with screenshots as evidence on issues (`qa/journey.ts`, #13 to #17, #36).

Limitations: the mockup's forked skill path and the richer celebration are still in flight (#35/#37, #40); social features are unbuilt (#6).

## Part 3: likely judge questions

**Why typed JSON slides and not generated HTML?**
Because model output is data and is rendered by code we own. A closed catalog (`src/contracts/components.ts`) means every slide is validated before it is stored, every component has a renderer we tested at 200% text scale and with axe, every visual carries a nonvisual explanation, and nothing a model writes can execute. It also makes lessons portable across native and web, and lets sub-agents add components without touching generation.

**Why derive node state instead of storing it?**
Stored state drifts: a lesson completed in another course, a tree added later, a rule changed by a migration would all need repair jobs. Deriving from completions plus rules on every read (`deriveNodeStates`) makes completion the only fact we store, makes reuse across courses free, and made the lock-bypass fix in PR #30 a one-place change: every read re-derives and returns 409 when still locked.

**Why Haiku for screening and Opus for generation?**
Screening is a short classification with a small contract; Haiku 5.5 is fast and cheap enough to run twice per course, and its verdict is validated like every other output. It fails closed. Planning and lesson writing are long, structured and pedagogical; Opus 5.5 with adaptive thinking and per-task effort gives the quality the lesson needs. Intake stays on standard-speed Opus because turns are short and the learner is waiting on each one.

**What happens when the model output fails validation?**
`generateStructured` validates with the full Zod contract. On failure it replays the attempt and sends up to 25 issues back ("fix exactly these issues, return the full corrected JSON"), once. If the second attempt fails, a typed `GenerationError('invalid')` reaches the route and the client shows an error with Retry; nothing invalid is stored. Refusals, truncation and API errors are separate kinds, logged with their tag. If the API rejects a schema for grammar mode, the call falls back to prompt-guided JSON and remembers that per schema.

**What does a course cost?**
Estimate; the server returns token usage per call but does not persist it yet (listed as a gap above). Prices from the Anthropic price list dated 2026-10-06: Opus 5.5 $4 in / $20 out per million tokens, fast mode $8 / $40, Haiku 5.5 $0.10 / $0.50. Thinking tokens bill as output and are the main uncertainty. Assumptions per call: screening twice on Haiku (~1.5k in, ~0.3k out: under a cent); three or four intake turns on standard Opus (~3k in, ~0.5k out each: about $0.09 total); one plan in fast mode at high effort (~6k in, ~6k out including thinking: about $0.29); companion (~$0.06); one lesson experience in fast mode at medium effort (~8k in, ~8k out: about $0.38). So: about $0.80 to get a learner to a ready first lesson, roughly $0.40 per further lesson, and $1 to $3 for a five-node course fully generated in fast mode; about half that with `ANTHROPIC_FAST_MODE=0`. Lesson reuse across courses and prompt caching of the stable system prompts lower the marginal cost further. Measured numbers would replace this estimate once usage is logged.

**Why fast mode if it costs twice as much?**
Time-to-first-lesson is the demo's weakest moment. PR #30 measured 48.6 s to course plus first lesson with fast mode against about 60 s without, with a per-process fallback to standard speed on 429. It is a one-line switch and intake never uses it.

**What would you do first with another week?**
Device QA (#9), persist token usage and generation timings per task, enforce the orientation-lesson shape in the contract (#21), the forked path and the richer celebration (#35, #40), hosting beyond Tailscale (#12), and a real account upgrade path on top of the anonymous token.
