# Product direction

## Promise

Learn anything, for a real reason. A learner says what they want to learn, a short conversation gathers only the context that matters, and the platform generates a personalized course: a skill tree of reusable lessons, each delivered as slides built from interactive components, with an assessment that teaches when the learner is wrong. The lead demonstration subject is mixology for a party host (base, acidity, sweetness, dilution, with a non-alcoholic option), but the platform is topic-agnostic and the demo exercises several subjects.

The core loop: goal → intake → course plan → orientation lesson → slides → assessment with teaching feedback → completion → next available node. The skill tree guides; it never traps. A hard assessment gives feedback and more attempts, not a locked door.

## What the learner sees

- **Home:** one input, "What do you want to learn?", plus discoverable courses, plus the courses they already have with one obvious Continue.
- **Intake:** the companion asks a few questions as a chat, suggests quick answers, and stops as soon as it has enough.
- **Skill tree:** a winding path of nodes: done, available, locked; optional branches to the side; a companion standing at the next one.
- **Lesson:** slides with text, callouts, ratio bars, diagrams, multiple choice and real-world checklists. Progress bar on top. Wrong answers teach.
- **Completion:** a brief celebration, the next node unlocked, the streak acknowledged.
- **Exploration:** at any point, "I want to learn something different / deeper" goes back through intake and reshapes the course without erasing progress.

## Feel

Inviting to open in an idle moment, not homework. Bright color, rounded shapes, chunky buttons, a companion with a few fixed moods and a generated costume per course. Reference neighborhood: Duolingo's obvious next action and celebration, Waterllama's one dominant action and a progress object that fills, Habitica's sense of ownership. Incentives are deliberately small: a streak and celebrations. No points economy, lives, leaderboards or penalties.

## Companion

One base character. Each course gets a generated name and costume (validated theme tokens; parts are app assets). Learners can rename and re-roll. Moods are fixed and chosen by the UI.

## Decided (2026-11-07)

Full platform during the hackathon with live generation; typed JSON slides from a component catalog; lessons reusable across courses with completion recognized everywhere; flexible progression rules; completion as the only lesson status, mastery as a derived concept; plan early, generate experiences on demand; rich text, structured; zero paid infrastructure beyond the API key.

## Pending

Social features (owners' brief to come). Voice input. Component catalog growth beyond the initial six. Hosting.

## Production-grade means evidence

Validated contracts at every boundary, deterministic scoring, versioned stored documents, recovery from failed generation without losing context, accessibility, tests, and a key that never leaves the server.
