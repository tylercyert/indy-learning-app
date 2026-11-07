# Security notes: dependency advisories

Triage of `npm audit` for issue #10 (tracked as #44). Run 2026-11-07 on `main` at `ecaf7b5`, read-only (`npm audit --json`, Node 24, lockfile `package-lock.json`). No dependency was changed.

## Summary

| Severity | Count |
|---|---|
| critical / high | 0 |
| moderate | 16 |
| low / info | 0 |

`docs/quality.md` recorded 12 moderate advisories at bootstrap. The count is now 16 because npm counts every package on a vulnerable chain, and `drizzle-kit` (added for migrations) pulls an old nested `esbuild` through `@esbuild-kit/esm-loader`. There are still only **three underlying advisories**; the other 13 entries are packages that depend on them.

**Conclusion: none of the three advisories is reachable in a running deployment.** They live in build-time and lint-time tooling (Expo CLI and fingerprint, typescript-eslint, drizzle-kit's config loader). The API server process (`server/src/**`, Hono + Drizzle ORM + better-sqlite3 + the Anthropic SDK) imports none of them, and the exported client bundle is static assets with no `glob`, `minimatch` or `esbuild` code. Recommendation for the hackathon: **accept all three**, keep `npm audit` in the quality checklist, and revisit when Expo and `eslint-config-expo` publish releases that lift the floors. Do **not** apply `npm audit fix --force`: every proposed fix is a semver-major downgrade (Expo 58 → 52, `eslint-config-expo` 58 → 6, `drizzle-kit` 0.31 → 0.18) that would break the app.

## Reachability model

Three places code can run:

1. **Server process** (`npm run server:start` / `server:dev`): `tsx` runs `server/src/index.ts`. Runtime dependencies: `hono`, `@hono/node-server`, `drizzle-orm`, `better-sqlite3`, `@anthropic-ai/sdk`, `zod`, `dotenv`. Migrations are applied by `drizzle-orm/better-sqlite3/migrator` reading SQL files from `server/drizzle/`; `drizzle-kit` is only used to *generate* those files (`npm run db:generate`) and for `db:studio`. The server never imports anything from `expo` or `@expo/*` (checked with grep over `server/src`).
2. **Client bundle** (`npm run web:export`, `export:all`): Metro produces static JS/HTML/assets in `dist/`. The vulnerable packages are tools that *produce* the bundle; none of their code is bundled into it.
3. **Developer machine / build time**: `expo start`, `expo export`, `eslint`, `drizzle-kit`. This is where all three advisories sit. Exposure requires an attacker to control inputs to those tools (paths passed to glob, lint-config patterns, a malicious local dev server client).

## Advisories

### A. `glob` AbortSignal cancellation bypass (GHSA-3g3m-2fjr-6pw4), moderate

- Vulnerable range: `glob >= 9.0.0 <= 14.0.1`. Installed: `glob@13.0.7` (`node_modules/glob`, marked `dev=false` in the lockfile only because `expo` is a production dependency).
- Chain: `expo@58.0.23` → `@expo/cli@58.1.19` and `@expo/fingerprint@0.21.9` → `glob`.
- Issue: a glob walk can continue traversing the filesystem after its AbortSignal fires (post-timeout traversal). It is a resource-exhaustion / cancellation bug, not code execution.
- Reachable at runtime? **No.** `@expo/cli` and `@expo/fingerprint` run on the developer machine during `expo start`, `expo export` and prebuild fingerprinting. Not in the server process, not in the client bundle.
- npm's fix: downgrade `expo` to `52.0.49` (semver-major). **Rejected**: SDK 58 is the project's runtime (`AGENTS.md`).
- Recommendation: **accept for the hackathon.** Revisit when an Expo 58 patch release moves `@expo/cli` / `@expo/fingerprint` to `glob >= 14.0.2`; check with `npm audit` after each `npx expo install --fix`.

### B. `minimatch` globparts amplification denial of service (GHSA-g3hv-75wg-m249), moderate

- Vulnerable range: `minimatch >= 7.0.0 < 11.0.1`. Installed: `minimatch@10.2.6` (`node_modules/minimatch`). Nested `minimatch@3.1.5` copies under `eslint`, `@eslint/*`, `eslint-plugin-import`, `eslint-plugin-react` are *below* the vulnerable range and are not flagged.
- Chains: (1) `expo` → `@expo/fingerprint` → `minimatch`; (2) `expo` → `@expo/cli` → `glob` → `minimatch`; (3) `eslint-config-expo@58.0.4` → `@typescript-eslint/eslint-plugin` / `parser` / `type-utils` / `utils` → `@typescript-eslint/typescript-estree@8.72.1` → `minimatch`; also `eslint-plugin-expo` → `@typescript-eslint/utils`.
- Issue: a crafted glob pattern with many brace expansions makes pattern parsing explode (CPU denial of service). Requires an attacker-controlled pattern.
- Reachable at runtime? **No.** Patterns come from Expo's own config and the repo's `eslint.config.js` / `tsconfig.json` at build and lint time. The server does not match globs; the client bundle contains no `minimatch`.
- npm's fix: downgrade `expo` to `52.0.49` and `eslint-config-expo` to `6.0.0` (both semver-major). **Rejected**: breaks the toolchain for a lint-time DoS that needs a hostile pattern in our own config.
- Recommendation: **accept for the hackathon.** Upgrade path: `eslint-config-expo` and `@typescript-eslint/*` releases that depend on `minimatch >= 11.0.1`; `npm update @typescript-eslint/typescript-estree` within the lockfile may already satisfy it once published (check `npm outdated`, no force).

### C. `esbuild` dev server allows any website to read responses (GHSA-67mh-4wv8-2f99), moderate

- Vulnerable range: `esbuild <= 0.24.2`. Installed: `esbuild@0.18.20` nested at `node_modules/@esbuild-kit/core-utils/node_modules/esbuild`. The top-level `esbuild@0.28.2` and drizzle-kit's own `esbuild@0.25.12` are patched.
- Chain: `drizzle-kit@0.31.11` (devDependency) → `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20`.
- Issue: esbuild's built-in *development server* (`esbuild.serve()`) set permissive CORS, so any website open in the same browser could read its responses. The vulnerability is in the serve feature only.
- Reachable at runtime? **No.** `@esbuild-kit/esm-loader` uses esbuild to *transform* `drizzle.config.ts` when `drizzle-kit generate` / `studio` runs. It never starts esbuild's dev server. The API server does not load `drizzle-kit`; it uses `drizzle-orm`'s migrator. (`drizzle-kit studio` opens its own UI, but through drizzle's server, not `esbuild.serve`.)
- npm's fix: downgrade `drizzle-kit` to `0.18.1` (semver-major). **Rejected**: 0.18 predates the config format and migration layout this repo uses.
- Recommendation: **accept for the hackathon.** Upgrade path: a `drizzle-kit` release that drops the deprecated `@esbuild-kit/*` loader (upstream has moved to `tsx`-style loading in newer lines); re-check `npm audit` after `npm update drizzle-kit` within the current major. Low priority because the package is a dev-only CLI.

## Entries that are chain echoes, not separate issues

npm lists these because they depend on A, B or C: `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `drizzle-kit`, `@expo/cli`, `@expo/fingerprint`, `expo`, `eslint-config-expo`, `eslint-plugin-expo`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`. Fixing A, B and C clears all 16.

## What this triage does not cover

- It is a dependency-advisory review, not a security review of the application. Known application-level limits (anonymous bearer tokens without rotation, CORS `*`, no API rate limiting, a single SQLite file, screening by a classifier) are listed in `docs/demo.md` under criterion 2 and belong on their own issues.
- `npm audit` sees only the npm registry's advisory database. Native layers (Expo modules, better-sqlite3's bundled SQLite) are not covered.
- The transitive `glob`/`minimatch` copies are flagged `dev=false` by npm because `expo` is a production dependency; that flag describes the manifest, not where the code runs.

## How to re-check

```sh
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
npm exec --yes --package=node@24 -- npm audit            # human summary
npm exec --yes --package=node@24 -- npm audit --json     # the data behind this page
npm exec --yes --package=node@24 -- npm outdated          # upgrade candidates within the lockfile's majors
```

Re-run after any `npx expo install` and after each Expo SDK patch. If a `high` or `critical` appears, or if an advisory lands in `hono`, `@hono/node-server`, `drizzle-orm`, `better-sqlite3`, `@anthropic-ai/sdk` or `zod`, that is a block until assessed: those are the server's runtime path.
