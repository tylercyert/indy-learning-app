# Quality gates

## Commands

```sh
npm ci                  # reproducible install from committed lockfile
npm run verify          # strict TypeScript, lint, unit tests
npm run export:all      # Metro bundles iOS, Android and web
npx expo-doctor          # Expo package/config health
npm audit               # inspect dependency advisories; do not force-upgrade blindly
```

Use Node 24. Bundle export validates bundling only. It does not sign a binary, boot a simulator, prove accessibility or test runtime interaction. Run the relevant device/browser smoke tests before claiming those behaviors work.

## Per PR

Record commit SHA, exact commands and results, acceptance evidence, known limits and an independent review. Check the current integration result before merging and integrated `main` afterward. Use a clean worktree/clone when validating someone else's code; do not disturb another worker's files.

## Tests to add with features

- Contract validation: malformed output, unknown versions, invalid options, bounded payloads.
- Scoring: correct/incorrect/invalid inputs; no model-dependent objective scoring.
- Persistence: save/reload, restart/resume, schema migration, corrupt/partial data and intentional reset.
- Adaptation: explanation, explicit accept/decline, one-time application and a new question.
- UI: loading/empty/error/offline states, repeated actions, back/close/cancel, small screens, large text, accessible labels and contrast.
- Provider: timeout, cancellation, malformed output, bounded retry and clearly labeled fixture fallback.

## Release decision

Production readiness requires real-device tests, privacy review, safe generation credentials, crash/error visibility, migration strategy and release/rollback planning. The initial repository passes only its foundation checks. No store signing, deployment, analytics or backend is provisioned.

## Automation

No GitHub Actions workflow, persistent runner, protected branch or required-status enforcement is enabled. These remain a tracked decision until the runner, access and cost model are approved. Manual local verification is mandatory meanwhile.

## Bootstrap dependency audit

On 2026-11-07, `npm audit` reported 12 moderate advisories, zero high/critical. The underlying advisories are [glob cancellation/traversal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), propagated through Expo CLI/fingerprint and TypeScript ESLint tooling. This is not a clean audit. Review reachability and compatible upgrades separately; npm's suggested force fix would downgrade major Expo packages and is not accepted automatically.
