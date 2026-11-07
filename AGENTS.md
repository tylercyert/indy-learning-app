# Agent working agreement

## Read first

Read `README.md`, `docs/product.md`, `docs/architecture.md`, `docs/factory.md`, the assigned GitHub issue and any nearer `AGENTS.md`. The issue defines the outcome, acceptance criteria, dependencies and owned paths. Repo documents must make the project understandable without private chat history.

## Work in isolation

- One active issue and one branch/worktree per implementer. Never share a dirty checkout or check out another agent's branch.
- Branch: `agent/<name>/<issue>-<slug>` (humans can use the same pattern).
- Claim work in the issue before editing. State owned files, proposed shared-contract changes and dependencies.
- A single owner per issue controls `src/contracts/**`. Agree and merge shared shapes before parallel consumers. Do not fork duplicate types inside features.
- Do not edit another worker's paths, revert their changes, use `git reset --hard`, or force push.
- Keep changes small. Do not introduce generic factory machinery, permanent role fleets or extra services just to support this app.

## Quality and honesty

Run `npm run verify` and `npm run export:all` on the final code. Report exact commands, results, commit SHA and untested surfaces. UI work also needs device/browser evidence, accessibility checks, back/cancel/retry and saved-progress recovery. Never call a bundle export a device test.

An independent person or agent reviews the diff and acceptance criteria. Record findings on the draft PR. An agent review is not a GitHub approval from a second account. No self-approval workaround and no claim that protections exist unless verified.

Use draft PRs linked with `Closes #<issue>`. Merge/release, new collaborators, public visibility and paid services need owner authorization. Do not create credentials or share API keys. No GitHub Actions or persistent self-hosted runner until the owner selects and authorizes the automation/cost approach. Local checks are the current gate, not automated enforcement.

## Runtime rules

- Expo SDK 58, React Native, TypeScript strict mode, Node 24 LTS, npm with lockfile.
- Before Expo/React Native API changes read matching docs: https://docs.expo.dev/versions/v58.0.0/ and https://docs.expo.dev/llms.txt. Do not trust remembered APIs.
- Use `npx expo install` for compatible runtime packages. Add only needed dependencies.
- Use Expo Router when navigation is introduced. The initial single-screen scaffold has no router yet.
- Keep generated `ios/`, `android/`, caches and secrets out of Git. Do not hand-edit generated native folders.
- Runtime-validate model output and persisted JSON. Infer types from shared schemas.
- Score objective answers with code. Keep learning preferences distinct from demonstrated evidence. Do not assign permanent learning-style labels.
- Never place a provider secret in `EXPO_PUBLIC_*` or a client build. Fixture mode must be clearly labeled.

## Stop and ask

After two failed approaches, summarize the blocker and propose the smallest next step. Stop for unclear ownership, incompatible contracts, data-loss risk or missing permission. Update the issue when blocked rather than silently accumulating local work.
