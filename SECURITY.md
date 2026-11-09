# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for a vulnerability.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an acknowledgement on the report, and a fix or a decision on it will be tracked there.

## Supported versions

Only the latest `main` is supported.

## How Poko handles secrets and model output

- The Anthropic API key lives only in `server/.env` on the API server. The Expo app never receives it, and nothing secret may be placed in an `EXPO_PUBLIC_*` variable.
- Every model response is validated against a Zod contract before it is stored or shown. Model output is treated as data: never markup, never code, never instructions.
- Slides are typed JSON from a closed component catalog. The app renders no generated HTML or scripts.
- Learner goals pass Goal Screening before planning; a screening failure blocks planning.

Dependency advisories and their reachability are tracked in [docs/security-notes.md](docs/security-notes.md).
