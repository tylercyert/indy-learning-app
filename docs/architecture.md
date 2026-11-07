# Architecture and ownership

## Small modules, explicit boundaries

Expo/React Native is the presentation layer. Shared Zod contracts live in `src/contracts`; pure scoring/progression rules belong in `src/domain`; feature UI in `src/features`; device storage and AI generation behind adapters in `src/services`. Start as one app package. Extract packages only when there is a real second consumer.

The initial `LearningPreferencesV1Schema` is a narrow contract seed for onboarding. It is not a completed curriculum, lesson, progress or assessment schema. The contracts issue must define those shapes before feature work consumes them. Use schema-inferred types rather than manually maintained copies.

## Contracts owner

Assign exactly one owner to the shared-contract issue. That person/agent owns `src/contracts/**` for that issue, publishes examples, versioning/migration expectations and validation tests, and gets consumer review. Until assignment, Tyler is the integration decision-maker, not an assumed active implementer. Sergio's role is chosen during onboarding; it is not preassigned.

A consumer needing a changed shape comments on the contract issue. The owner lands the compatible change first. Breaking changes need a schema version and migration strategy. Code owners and GitHub enforcement are not configured yet.

## Data and generation

Keep local persistence separate from business rules. Every stored document has a schema version. Plan migrations, restart/resume, corrupt-data recovery and a deliberate reset flow before calling persistence complete. Do not log raw learner content unnecessarily.

AI is a content provider, not the source of truth for scoring or mastery. Treat every model response as untrusted. Validate shape and content constraints, limit retries, support timeout/cancel and use clear fallback states. Never execute generated scripts or unsanitized markup.

The demo is local-first, not automatically offline: live AI requires a network and a safe credential boundary. No shared secret may ship in the client. Start fixture-first. Before live generation, approve a minimal local/server proxy or another safe provider approach; no backend or key handling is provisioned now.

## Navigation and visuals

The seed is a single screen. Add Expo Router in the journey issue once routes are known. Keep lesson state independent of route files. Prefer accessible native controls and predictable back/close behavior. Generated visuals need a nonvisual explanation and clear purpose.
