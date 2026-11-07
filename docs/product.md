# Product direction

## Promise

Help someone learn a transferable skill for a real situation. Initial demonstration: someone hosting a party learns mixology principles (base, acidity, sweetness and dilution), including a non-alcoholic option, rather than memorizing one drink recipe. This is the lead scenario, not a restriction on future subjects.

The core loop is: goal and starting experience → short lesson panes → assessment → explanation/correction → learner choice about the proposed adaptation → fresh application question. A wrong answer must teach the correct principle, not merely mark a mistake.

## First usable slice

- Onboarding asks the goal and a few placement questions. Offer “Get me started” for beginners and “Take me further” for someone with some experience. Offer “I need this tonight” for a focused quick win and “I want to get really good” for a deeper journey. Time horizon is separate from difficulty; never label a short session as mastery.
- A generated, video-game-like skill tree makes principles, prerequisites and the next step understandable. The learner chooses which branch to explore. For the hackathon show one beginner path, one level-up path and a simple pace toggle.
- Informational, assessment and activity panes share a typed content contract.
- Objective text-based assessments use deterministic scoring. Free-text feedback acknowledges uncertainty. Voice scoring is deferred.
- Progress and multiple courses live on the device. Feedback and success history can inform the next section after the learner explicitly chooses it.
- Demonstrate one complete loop, one useful visual and a second topic once the main loop is reliable.
- Keep a labeled fixture/backup demonstration when live generation is unavailable.

## Fun and motivation

The app should feel inviting to open during an idle moment, not like homework. Take cues from Duolingo: short challenges, satisfying feedback, small incentives and a skill tree that visibly grows. Gamification is a deliberate part of the concept, alongside learner-controlled adaptation. Exact mechanics (XP, streaks, celebrations or rewards) have not been selected; choose a small, coherent set before implementing them. Reward useful practice, not just screen time. A friendly mascot is a possible polish element, not a settled design.

## Custom paths

A learner can follow generated branches or discuss creating a custom branch at any point. Preserve that direction in the architecture even if the first demo uses a small fixed tree. A future backend could learn from successful branch structures across learners; the demo does not collect/share that data or require a backend.

## Platforms

Use Expo + TypeScript. iPhone and iPad need thoughtful layouts, touch targets, larger-text support and portrait/landscape behavior where relevant. Web is the fastest shared smoke-test surface, not proof that native UI is verified. Noir is the shared development host; Apple simulator/signing/device work requires an appropriate Mac lane later.

## Future direction, not promises for the first slice

Custom skill-tree branches, experience-based placement, level-up routes, adjustable lesson size and pacing, richer generated visuals, cross-device sync, accounts and a backend. Distinguish learner-stated preferences from evidence of mastery. Do not infer a permanent learning style from a single response.

## Non-goals today

A generalized agent platform, five always-on roles, social feeds, voice assessment, full profile dashboards, payments, store distribution or a large backend. The separate agent-memory idea is outside this repository.

## Production-grade means evidence

Versioned persisted data, runtime validation, deterministic core rules, error recovery, accessibility, tests and safe key handling. The initial scaffold establishes these boundaries; it does not make the app production-ready.
