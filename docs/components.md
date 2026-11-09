# Adding a slide component

Slides are ordered lists of components from a closed catalog. The model can only use components that exist in the catalog, and every component it writes is validated before anyone sees it. This guide lists every place a new component touches, which of them the compiler or tests enforce, and who owns each part.

The catalog today: `text`, `callout`, `ratioBar`, `diagram`, `checklist`, `multipleChoice`, `codeBlock`, `fillBlank`, `matchPairs`.

## 1. Choose the role

| Role | The learner… | Produces a result? | Scored? |
|---|---|---|---|
| presentational | reads or looks | no | no |
| interactive | does something (e.g. ticks real-world steps) | yes, recorded | never |
| assessable | answers | yes, recorded | yes, by code in `src/domain` |

Assessable components carry a teaching explanation for every way of being wrong. Scoring never involves the model.

## 2. Touchpoints

Work through these in order. "Enforced" means a missed step fails `npm run verify`.

| Step | File | Enforced |
|---|---|---|
| Props schema with explicit length and count limits, exported constants for the limits, added to `ComponentV1Schema` | `src/contracts/components.ts` | Zod validation tests |
| Manifest entry: role and a one-sentence `whenToUse` the generator reads | `COMPONENT_MANIFESTS` in `src/contracts/components.ts` | compiler (`Record<ComponentType, …>`) |
| Result schema, added to `ComponentResultV1Schema` (interactive and assessable only) | `src/contracts/components.ts` | — |
| Scorer plus unit tests (assessable only) | `src/domain/scoring.ts`, `src/domain/domain.test.ts` | your tests |
| Event request and scored response fields (interactive and assessable) | `ExperienceEventRequestSchema` in `src/contracts/api.ts` | — |
| Server branch that scores and records the event | `server/src/services/progress.ts` and its test | your tests |
| Renderer, with a nonvisual description for anything visual, keyboard support and 200% text | `src/features/components/<Name>.tsx` | — |
| Case in the slide renderer | `ComponentRenderer` in `src/features/components/SlideView.tsx` | compiler (exhaustive `never` check) |
| Answer handling and correction sheet in the lesson player (assessable) | `app/lesson/[id].tsx` | — |
| Usage rules and limits in the generation prompt | `EXPERIENCE_SYSTEM` in `server/src/ai/prompts.ts` | `server/src/ai/catalog.test.ts` |
| Stress fixtures at the limits, generated from the contract constants | `qa/fixtures/stress/generate.ts` then the JSON files | `server/src/ai/catalog.test.ts` |
| Live drivers answer it | `qa/journey.ts`, `server/scripts/smoke.ts` | journey and smoke runs |

## 3. Prove it

```sh
npm run verify                                  # compiler, lint, unit and catalog tests
npx tsx qa/fixtures/stress/generate.ts          # regenerate fixtures from the limits
npm run qa:slides                               # render every fixture through /dev/slide
QA_TEXT_SCALE=2 npm run qa:slides               # and at 200% text
npx tsx qa/a11y/audit.ts                        # axe-core and keyboard passes
npm run qa:journey "a goal that needs it"       # a generated lesson that uses it, end to end
```

Look at the screenshots before claiming a visual result. A bundle export is not a device test.

## Ownership

`src/contracts/**` is shared by the app and the server and has one owner at a time (see `AGENTS.md`). A contributor or sub-agent adding a component writes the renderer, scorer, tests and fixtures, and proposes the contract and prompt changes in the same pull request for the contracts owner to review.

## Why the catalog is not one folder per component

The original plan (issue #8) put each component in its own folder with a schema, manifest, renderer and test, assembled by a registry. That was not adopted. The component union, the result union and the API event union are each one Zod discriminated union validated at a trust boundary, and splitting them across folders would hide what the model is allowed to produce. Instead, the manifest table and the renderer switch are checked by the compiler, and the catalog test checks prompts and fixtures, so a missed touchpoint fails the gate rather than reaching a learner.
