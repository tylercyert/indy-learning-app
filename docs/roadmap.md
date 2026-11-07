# Roadmap

Work is tracked in [GitHub Issues](https://github.com/tylercyert/indy-learning-app/issues) under the milestone "First complete learning loop". This page is the map, not the tracker. Status as of 2026-11-07 (`main` at `ecaf7b5`).

| Slice | Issue | Status | What a learner can do when it lands |
|---|---|---|---|
| 1 Foundation | #1 | done (`41d745b`) | Nothing visible yet: contracts, rules, server, router shell |
| 2 First complete loop | #2 | done (PR #19) | State a goal, answer intake, get a course, finish the orientation lesson |
| 3 Skill tree | #3 | done (PR #19, #22, #26); branching layout continues as #35 | See the winding path, open nodes as they unlock, celebrate, keep a streak |
| 4 History and reuse | #4 | done (PR #22) | Get lessons that know what they already did; rename or re-roll the companion; keep going after a course |
| 5 Discovery and exploration | #5 | done (PR #22) | Start from an existing course; ask to go somewhere different mid-course |
| 6 Social | #6 | blocked: owners' brief | Pending the owners' brief |

Landed after the slices, same day: lock hardening, no pre-completed nodes on new courses, Anthropic fast mode and ratio-bar bounds (#29, PR #30); Goal Screening before intake and planning (#31, PR #32); component hardening with `codeBlock` and `fillBlank` (#23, #33, PR #34). A Linear mirror was tried and removed (#24, PR #25 then #27); GitHub Issues are the only tracker.

In progress: branching skill-path layout from the mockup (#35); component-hardening lane (#23, continuous); deferred QA items (#20).

Cross-cutting, open: component folder contract for sub-agents (#8), device QA on iPhone and iPad (#9, owners), dependency advisories (#10), license (#11), hosting (#12), orientation lesson shape at the contract (#21).

Resolved cross-cutting: structured-output limits and the grammar/prompt fallback (#7) are documented in `docs/handoff.md`; QA lanes #13–#17 were acted on in PR #19, #22, #26 and #34, with the remainder on #20 (layout, a11y, content) and #23 (component stress).

Details and acceptance criteria live on each issue and in `docs/implementation-plan.md`. Vocabulary is in `CONTEXT.md`.
