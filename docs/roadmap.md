# First milestone

[GitHub Issues](https://github.com/tylercyert/indy-learning-app/issues) is the live tracker. This is work sequence, not a second status board.

1. Repository foundation and onboarding.
2. Agree lesson, skill-tree, assessment and versioned progress contracts.
3. Build learner journey and first skill path.
4. Add deterministic assessment, correction and learner-controlled adaptation.
5. Add local save/resume with migration and recovery tests.
6. Add safe generation/visuals after choosing credentials boundary; keep fixture fallback.
7. Integrate demo, test interrupted flows and capture backup.
8. Approve PR/main automation, branch protections and application licensing.

Assign one shared-contract owner before parallel consumer work. Ownership and status live on issues.

## Draft acceptance checklist (not published issues)

- **Contracts:** one owner, versioned lesson panes/tree/progress/assessment schemas, runtime validation, malformed-input fixtures and consumer review. Include beginner/level-up entry and quick-win/deeper-journey choices.
- **Journey:** goal and placement, path/pace choice, navigable skill tree, readable panes, visible progress and a small agreed set of fun incentives. Test iPhone/iPad layout plus back/cancel/retry.
- **Assessment/adaptation:** deterministic objective scoring, teach the correction, explain a proposed adaptation, explicit accept/decline, and a fresh application question. Free text must acknowledge uncertainty.
- **Persistence:** save/resume multiple courses locally, schema versions, migration, corrupt/partial-data recovery and reset tests. No shared backend needed for the demo.
- **Generation/visuals:** agreed safe provider boundary, runtime-validated content, timeouts/cancel/bounded retries, useful accessible visuals, and clearly labeled fixture fallback. Never ship shared secrets.
- **Demo integration:** mixology-framework lesson, beginner and level-up paths, pace toggle, second topic if the main loop is reliable, real flow testing and a recorded backup. Explain what AI does and what deterministic code does.
- **Quality/infrastructure:** dependency-advisory triage, license clarification, approved automatic PR/main test execution, required-check/branch-protection decision and reproducible evidence. Do not call any of these operational before verification.

No implementer or reviewer is assigned by this list. Publish scoped issues after approval, then track their state only in GitHub.
