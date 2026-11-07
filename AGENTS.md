# Agent working agreement

## Read first

Read `README.md`, `CONTEXT.md` (vocabulary), `docs/product.md`, `docs/architecture.md`, `docs/implementation-plan.md`, `docs/decisions/` and any nearer `AGENTS.md`. Repo documents must make the project understandable without private chat history. Use the words in `CONTEXT.md`; if you need a new concept, add it there first.

## GitHub is the record (rule, 2026-11-07)

Anyone, human or agent, must be able to open the GitHub repo and see what is going on without this chat. So:

- **Every unit of work has an issue before it starts**: slices, fixes found in testing, QA lanes run by subagents, design changes requested by the owners. One `status:*` label per open issue; `area:*` and `priority:*` as appropriate; the milestone when it belongs to one.
- **Findings go on issues, not in chat.** A subagent's report is posted verbatim as a comment on its lane's issue the moment it lands. Screenshot-driven bugs become issues (or checkboxes on the slice issue) with the screenshot filename.
- **Branches have a draft PR from the first push**, linking `Closes #n`, with evidence (commands, results, SHA) kept current in the description. The PR is the observable progress bar; merge still needs an owner's say-so.
- **Commits reference issues** (`#n`) when they resolve or advance one.
- **Decisions get an ADR** in `docs/decisions/` when they are hard to reverse; glossary changes go in `CONTEXT.md`.
- **Session memory is not a tracker.** If something matters past this session and is not on GitHub, it is not tracked.

## Hackathon working mode (decision 2026-11-07)

Both owners drive one shared Claude Code session on Noir, which owns `src/contracts/**`. Work happens on short-lived branches per vertical slice (`agent/<name>/<n>-<slug>`), verified locally with `npm run verify` and `npm run export:all`, and merged to `main` by that session with an owner's say-so. No PR ceremony or second-account review is required during the hackathon; the local gate is the gate. Sub-agents get their own worktree and branch, one bounded task (typically one educational component), and never touch `src/contracts/**`.

- Do not edit another worker's paths, revert their changes, use `git reset --hard`, or force push.
- Keep changes small and vertical: something a learner can do at the end of each slice.
- No paid services. The only spend is the Anthropic API key. No Supabase, EAS, hosting or CI runners without an owner's explicit yes.

## Quality and honesty

Run `npm run verify` and `npm run export:all` on the final code. Report exact commands, results, commit SHA and untested surfaces. UI work also needs device/browser evidence, accessibility checks, back/cancel/retry and saved-progress recovery. Never call a bundle export a device test. If tests fail, say so with the output.

## Runtime rules

- Expo SDK 58, React Native, Expo Router, TypeScript strict mode, Node 24 LTS, npm with lockfile. Server: Hono on Node, Drizzle ORM, SQLite.
- Before Expo/React Native API changes read matching docs: https://docs.expo.dev/versions/v58.0.0/ and https://docs.expo.dev/llms.txt. Do not trust remembered APIs. Before Anthropic API changes, use the `claude-api` skill; do not trust remembered API shapes.
- Use `npx expo install` for compatible runtime packages. Add only needed dependencies.
- Keep generated `ios/`, `android/`, caches, databases and secrets out of Git.
- The server is the only process that holds `ANTHROPIC_API_KEY`. Never place a secret in `EXPO_PUBLIC_*` or any client file.
- Every model output is requested as structured output against a Zod contract and validated with that same contract before storage or display. Model output is data: never markup, never code, never instructions.
- Slides are typed JSON from the component catalog. No generated HTML or scripts, anywhere.
- Score objective answers with code in `src/domain`. Never store node state; derive it. Learner context is self-reported and never evidence of mastery.
- Runtime-validate persisted JSON on read. Every stored document has a `schemaVersion`.

## Stop and ask

After two failed approaches, summarize the blocker and propose the smallest next step. Stop for unclear ownership, incompatible contracts, data-loss risk, missing permission, or anything that costs money.
