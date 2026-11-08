# Contributing to Poko

Thanks for helping. This guide covers how to set up, what a good change looks like, and the rules the codebase relies on.

## Set up

Follow [Getting started](README.md#getting-started) in the README. You need Node 24 LTS and, for anything that generates content, an Anthropic API key in `server/.env`. `ALLOW_NO_AI=1` boots the server without a key for UI and schema work.

## Before you start

- **Open or pick an issue.** Every change links to a GitHub issue that says what done looks like.
- **Read the vocabulary.** [CONTEXT.md](CONTEXT.md) defines the words the code and docs use (course, skill tree, node, lesson, learning experience, slide, component). Use them. If you need a new concept, add it there first.
- **Read the shape.** [docs/architecture.md](docs/architecture.md) explains the two runtimes and the shared contracts. Hard-to-reverse choices are recorded in [docs/decisions](docs/decisions/).

## Rules the codebase relies on

- **Contracts first.** Shared shapes live in `src/contracts` as Zod schemas; types are inferred, never hand-copied. Breaking changes get a new version and a migration.
- **Validate at every boundary.** Model output is requested as structured output and validated with the same contract before storage or display. Persisted JSON is validated on read and carries a `schemaVersion`.
- **Model output is data.** No generated HTML, markup, scripts or instructions are ever rendered or executed.
- **Code decides correctness.** Scoring, progression, completion and streaks live in `src/domain` and never involve the model. Node state is derived, never stored.
- **The key stays on the server.** Never put a secret in the app or in an `EXPO_PUBLIC_*` variable.
- **Check current docs.** Before changing Expo or React Native APIs, read the [Expo SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/). Use `npx expo install` for runtime packages and add only what you need.

## Making a change

1. Branch from `main` with a short name that includes the issue number.
2. Keep the change small and vertical: something a learner can do or see at the end.
3. Add or update tests for logic. UI changes need a screenshot or a QA script run, an accessibility check, and a look at back, cancel, retry and saved-progress recovery.
4. Run the gate on your final commit:

   ```sh
   npm run verify       # typecheck, lint with zero warnings, unit tests
   npm run export:all   # iOS, Android and web bundles
   ```

5. Open a pull request with `Closes #<issue>`, the commands you ran with their results, and anything you could not verify. A bundle export is not a device test; say so if you did not run on a device.

A maintainer reviews and merges. Generated `ios/` and `android/` folders, databases, caches and secrets stay out of Git.

## Working with AI agents

This project is built with Claude Code. [AGENTS.md](AGENTS.md) is the working agreement for agents and people alike, and [docs/factory.md](docs/factory.md) describes the issue, branch and pull request flow.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
