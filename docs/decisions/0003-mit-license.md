# 0003: The application code is MIT licensed

Date: 2026-11-08. Status: proposed by the main session on the owners' request to license the repository (#11); accepted when the owners merge it.

After the hackathon the owners asked for the repository to be branded and licensed so it reads as a real project. The repository is public, the app grew from Expo's MIT-licensed template, and the code has no commercial or patent constraints the owners have raised. MIT keeps the project easy to reuse and learn from, and matches the template's notice, which stays in `LICENSE` for the template-derived portions.

## Considered options

- Apache-2.0: adds an explicit patent grant and a NOTICE requirement. Reasonable, but heavier than the owners need today.
- All rights reserved (no license): keeps every option open commercially, but a public repository without a license cannot legally be reused, which works against a project meant to be read and built on.
- GPL or AGPL: would require derivative apps and hosted forks to publish their source. Not requested and limiting for an app-store app.

## Consequences

- `LICENSE` names "Tyler Cyert and the Poko contributors" as copyright holders and keeps Expo's 2015-present notice for template portions.
- `package.json` declares `"license": "MIT"`; the README states it.
- Brand assets (the Poko name, character and icons) are covered by the same license as code because they are drawn in code. If the owners want to protect the character separately, that needs a separate trademark or asset license decision.
- Contributions are accepted under the same license (stated in `CONTRIBUTING.md`).
