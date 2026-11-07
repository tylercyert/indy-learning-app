# Indy Learning App

A local-first learning app built with Expo and TypeScript. Teach reusable skills, not just answers: learn a principle, try it, understand a mistake, choose an adaptation, and apply it again.

**Status:** repository foundation, not a finished product. No live AI provider, persistence, account system, autonomous agents, deployment, or automated GitHub checks is configured yet.

## Start here

- [Product and scope](docs/product.md)
- [Architecture and shared contracts](docs/architecture.md)
- [How this lightweight factory works](docs/factory.md)
- [Sergio / contributor onboarding](docs/onboarding.md)
- [Checks and release readiness](docs/quality.md)
- [Decisions](docs/decisions/0001-lean-foundation.md)
- [GitHub issues: the live work tracker](https://github.com/tylercyert/indy-learning-app/issues)
- [First milestone and work order](docs/roadmap.md)

## Run

Use **Node 24 LTS** (at least 24.3). Node 25 is not supported by this Expo SDK.

```sh
nvm install
nvm use
npm ci
npm run verify
npm run web
# or: npm start, then open an SDK-compatible Expo Go app
# or: npm run ios (macOS + Xcode), npm run android (Android tooling)
```

If you do not use nvm, install Node 24 through your normal Node version manager. Nothing requires a global Expo CLI or shared credentials. Run `npx expo install <package>` for Expo-compatible dependencies. Commit `package-lock.json` changes.

## Repository layout

- `App.tsx`: minimal starter screen; future navigation uses Expo Router.
- `src/contracts/`: versioned Zod schemas and inferred shared TypeScript types.
- `src/domain/`: pure learning rules, scoring, progression (to be built).
- `src/features/`: learner-facing features (to be built).
- `src/services/`: storage and generation adapters (to be built).
- `docs/`: durable product, architecture, workflow and onboarding context.
- `.github/`: issue and pull-request templates. No Actions workflows.

Keep runtime truth in code, work status in GitHub issues, decisions in these docs. Do not maintain a second issue board in Markdown.

## Privacy and licensing

The GitHub repository is public for the competition. Adding collaborators, deploying or submitting a store build still requires owner approval. Do not copy private factory-core source or private operational records into this repository.

`LICENSE` retains the Expo starter's original MIT notice. It is not a new licensing decision for the team's original application code. Choose an application license before public distribution.
