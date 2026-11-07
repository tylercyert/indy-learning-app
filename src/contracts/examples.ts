import type { CoursePlanV1, GeneratedSlidesV1, SkillTreeV1 } from './index';

/**
 * Valid example documents. Used by tests and as few-shot references in generation prompts.
 * If a contract changes, these must still parse; the tests enforce it.
 */

export const exampleSlides: GeneratedSlidesV1 = {
  slides: [
    {
      id: 'why-sour',
      title: 'Sour keeps sweet from tasting flat',
      purpose: 'teach',
      components: [
        {
          id: 'intro',
          type: 'callout',
          speaker: 'companion',
          tone: 'explain',
          content: { blocks: [{ type: 'paragraph', inlines: [{ text: "Here's the one idea behind every great sour drink." }] }] },
        },
        {
          id: 'body',
          type: 'text',
          content: {
            blocks: [
              {
                type: 'paragraph',
                inlines: [
                  { text: 'Sugar makes a drink feel heavy. Acid cuts through it so flavors taste bright instead of syrupy. ' },
                  { text: "It's the ratio that matters.", marks: ['bold'] },
                ],
              },
            ],
          },
        },
        {
          id: 'ratio',
          type: 'ratioBar',
          title: 'A classic sour, by volume',
          segments: [
            { label: 'base', parts: 2, color: 'primary' },
            { label: 'sour', parts: 1, color: 'accent' },
            { label: 'sweet', parts: 1, color: 'secondary' },
          ],
          altText: 'Bar showing two parts base, one part sour, one part sweet.',
        },
      ],
    },
    {
      id: 'check',
      title: 'Quick check',
      purpose: 'assess',
      components: [
        {
          id: 'q1',
          type: 'multipleChoice',
          prompt: "A guest says their drink tastes flat and syrupy. What's the fix?",
          options: [
            { id: 'a', text: 'Add more of the base spirit', explanation: 'More base adds strength, not brightness. Still syrupy.' },
            { id: 'b', text: 'Add fresh citrus juice', explanation: 'Yes. Acid is the lever that cuts sweetness.' },
            { id: 'c', text: 'A little more simple syrup', explanation: "That's the opposite direction; sweet is already too high." },
            { id: 'd', text: 'Shake longer with more ice', explanation: 'Dilution weakens everything but keeps the same sweet-to-sour ratio.' },
          ],
          correctOptionId: 'b',
        },
      ],
    },
    {
      id: 'try-it',
      title: 'Tonight, taste it',
      purpose: 'wrapUp',
      components: [
        {
          id: 'steps',
          type: 'checklist',
          title: 'Tonight, taste it',
          items: [
            { id: 'mix', text: 'Mix 2:1:1 with cold tea as the base' },
            { id: 'taste', text: 'Taste, then add a squeeze of lime' },
            { id: 'notice', text: 'Notice what changed' },
          ],
          confirmLabel: 'I tried it',
        },
      ],
    },
  ],
};

export const examplePlan: CoursePlanV1 = {
  title: 'Party-ready mixology',
  subject: 'mixology',
  summary: 'Balance base, sour, sweet and dilution so you can fix any drink, including a non-alcoholic one.',
  treeTitle: 'Balance basics',
  companion: {
    schemaVersion: 1,
    name: 'Zest',
    bodyColor: '#FF7A59',
    cheekColor: '#FFB4A2',
    accentColor: '#14B8A6',
    headpiece: 'sprig',
    prop: 'umbrella',
    greeting: "Saturday's getting closer! Got 5 minutes?",
  },
  nodes: [
    {
      id: 'orientation',
      title: 'What makes a drink taste right',
      objective: 'Name the four things every balanced drink has: base, sour, sweet, dilution.',
      kind: 'orientation',
      required: true,
      rule: {},
      lesson: { source: 'new', difficulty: 'intro', estimatedMinutes: 4, tags: ['balance'] },
    },
    {
      id: 'acidity',
      title: 'Acidity',
      objective: 'Use acid to fix a drink that tastes flat or syrupy.',
      kind: 'core',
      required: true,
      rule: { allOf: ['orientation'] },
      lesson: { source: 'new', difficulty: 'core', estimatedMinutes: 5, tags: ['acid', 'citrus'] },
    },
    {
      id: 'dilution',
      title: 'Dilution',
      objective: 'Explain how ice and shaking change strength without changing ratio.',
      kind: 'core',
      required: true,
      rule: { allOf: ['orientation'] },
      lesson: { source: 'new', difficulty: 'core', estimatedMinutes: 5, tags: ['ice'] },
    },
    {
      id: 'non-alc',
      title: 'Non-alcoholic twist',
      objective: 'Rebuild a sour with no spirit using a strong non-alcoholic base.',
      kind: 'optional',
      required: false,
      rule: { allOf: ['acidity'] },
      lesson: { source: 'new', difficulty: 'core', estimatedMinutes: 4, tags: ['non-alcoholic'] },
    },
    {
      id: 'design',
      title: 'Design your own drink',
      objective: 'Choose a base and balance it into a drink you can name.',
      kind: 'core',
      required: true,
      rule: { atLeast: { count: 2, of: ['acidity', 'dilution', 'non-alc'] } },
      lesson: { source: 'new', difficulty: 'advanced', estimatedMinutes: 8, tags: ['synthesis'] },
    },
  ],
};

export const exampleTree: SkillTreeV1 = {
  schemaVersion: 1,
  id: '5a3f6a9c-9c4e-4a1b-8d2e-1f0c7b6a5d43',
  courseId: '7d2f8e1a-3b4c-4d5e-9f60-a1b2c3d4e5f6',
  title: 'Balance basics',
  sequence: 0,
  createdAt: '2026-11-07T18:00:00.000Z',
  nodes: examplePlan.nodes.map((n, i) => ({
    id: n.id,
    lessonId: `00000000-0000-4000-8000-00000000000${i}`,
    title: n.title,
    objective: n.objective,
    kind: n.kind,
    required: n.required,
    rule: n.rule,
  })),
};
