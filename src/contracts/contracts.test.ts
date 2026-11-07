import { describe, expect, it } from 'vitest';
import {
  BASE_COMPANION,
  CompanionThemeV1Schema,
  ComponentV1Schema,
  CoursePlanV1Schema,
  GeneratedSlidesV1Schema,
  IntakeTurnV1Schema,
  LearnerContextV1Schema,
  ProgressionRuleV1Schema,
  RichTextV1Schema,
  SkillTreeV1Schema,
  SlideV1Schema,
  richTextToPlain,
} from './index';
import { examplePlan, exampleSlides, exampleTree } from './examples';

describe('RichTextV1', () => {
  it('accepts headings, lists and marked inlines', () => {
    const doc = RichTextV1Schema.parse({
      blocks: [
        { type: 'heading', level: 2, inlines: [{ text: 'Why acid' }] },
        { type: 'bulletList', items: [[{ text: 'cuts sweet', marks: ['bold'] }], [{ text: 'adds brightness' }]] },
        { type: 'paragraph', inlines: [{ text: 'Read more', href: 'https://example.com/acid' }] },
      ],
    });
    expect(richTextToPlain(doc)).toBe('Why acid\ncuts sweet\nadds brightness\nRead more');
  });
  it.each([
    { href: 'http://example.com' },
    { href: 'javascript:alert(1)' },
    { href: 'https://' },
  ])('rejects non-https links %j', (inline) => {
    const result = RichTextV1Schema.safeParse({ blocks: [{ type: 'paragraph', inlines: [{ text: 'x', ...inline }] }] });
    expect(result.success).toBe(false);
  });
  it('rejects unknown block types and raw html fields', () => {
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'html', html: '<b>x</b>' }] }).success).toBe(false);
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'paragraph', inlines: [{ text: 'x' }], html: '<b>' }] }).success).toBe(false);
  });
});

describe('components', () => {
  const choice = exampleSlides.slides[1]!.components[0]!;
  it('requires correctOptionId to be one of the options', () => {
    expect(ComponentV1Schema.safeParse({ ...choice, correctOptionId: 'zz' }).success).toBe(false);
  });
  it('rejects duplicate option ids', () => {
    const dup = { ...choice, options: [...(choice as any).options.slice(0, 3), { ...(choice as any).options[0] }] };
    expect(ComponentV1Schema.safeParse(dup).success).toBe(false);
  });
  it('rejects a diagram edge to an unknown node', () => {
    const result = ComponentV1Schema.safeParse({
      id: 'd',
      type: 'diagram',
      nodes: [{ id: 'a', label: 'A', shape: 'box', x: 10, y: 10 }],
      edges: [{ from: 'a', to: 'b' }],
      altText: 'A points to B',
    });
    expect(result.success).toBe(false);
  });
  it('rejects raw hex colors on ratio segments', () => {
    const bar = exampleSlides.slides[0]!.components[2] as any;
    const bad = { ...bar, segments: [{ ...bar.segments[0], color: '#FF0000' }, bar.segments[1]] };
    expect(ComponentV1Schema.safeParse(bad).success).toBe(false);
  });
  it('allows at most one assessable component per slide', () => {
    const slide = exampleSlides.slides[1]!;
    const two = { ...slide, components: [slide.components[0], { ...slide.components[0], id: 'q2' }] };
    expect(SlideV1Schema.safeParse(two).success).toBe(false);
  });
});

describe('GeneratedSlidesV1', () => {
  it('accepts the example lesson', () => {
    expect(GeneratedSlidesV1Schema.safeParse(exampleSlides).success).toBe(true);
  });
  it('requires at least one assessable component overall', () => {
    const noAssess = { slides: [exampleSlides.slides[0], exampleSlides.slides[2]] };
    const result = GeneratedSlidesV1Schema.safeParse(noAssess);
    expect(result.success).toBe(false);
  });
  it('rejects duplicate slide ids', () => {
    const dup = { slides: [exampleSlides.slides[0], { ...exampleSlides.slides[1], id: 'why-sour' }] };
    expect(GeneratedSlidesV1Schema.safeParse(dup).success).toBe(false);
  });
});

describe('ProgressionRuleV1 and SkillTreeV1', () => {
  it('accepts allOf, anyOf and atLeast together', () => {
    expect(
      ProgressionRuleV1Schema.safeParse({ allOf: ['a'], anyOf: ['b', 'c'], atLeast: { count: 1, of: ['d', 'e'] } }).success,
    ).toBe(true);
  });
  it('rejects atLeast count above the option count', () => {
    expect(ProgressionRuleV1Schema.safeParse({ atLeast: { count: 3, of: ['a', 'b'] } }).success).toBe(false);
  });
  it('accepts the example tree', () => {
    expect(SkillTreeV1Schema.safeParse(exampleTree).success).toBe(true);
  });
  it('rejects a rule that references an unknown node', () => {
    const nodes = exampleTree.nodes.map((n) => (n.id === 'acidity' ? { ...n, rule: { allOf: ['ghost'] } } : n));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes }).success).toBe(false);
  });
  it('rejects cycles', () => {
    const nodes = exampleTree.nodes.map((n) => (n.id === 'orientation' ? { ...n, rule: { allOf: ['design'] } } : n));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes }).success).toBe(false);
  });
  it('rejects a tree with no root', () => {
    const nodes = exampleTree.nodes.map((n, i, all) => ({ ...n, rule: { allOf: [all[(i + 1) % all.length]!.id] } }));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes }).success).toBe(false);
  });
  it('rejects progress fields on nodes (state is derived, never stored)', () => {
    const nodes = exampleTree.nodes.map((n) => ({ ...n, status: 'done' }));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes }).success).toBe(false);
  });
});

describe('CoursePlanV1', () => {
  it('accepts the example plan', () => {
    expect(CoursePlanV1Schema.safeParse(examplePlan).success).toBe(true);
  });
  it('requires exactly one orientation node that is a root', () => {
    const noOrientation = { ...examplePlan, nodes: examplePlan.nodes.map((n) => ({ ...n, kind: 'core' as const })) };
    expect(CoursePlanV1Schema.safeParse(noOrientation).success).toBe(false);
    const gated = {
      ...examplePlan,
      nodes: examplePlan.nodes.map((n) => (n.kind === 'orientation' ? { ...n, rule: { allOf: ['acidity'] } } : n)),
    };
    expect(CoursePlanV1Schema.safeParse(gated).success).toBe(false);
  });
});

describe('CompanionThemeV1', () => {
  it('accepts the base companion', () => {
    expect(CompanionThemeV1Schema.safeParse(BASE_COMPANION).success).toBe(true);
  });
  it('rejects a body too dark for ink features', () => {
    expect(CompanionThemeV1Schema.safeParse({ ...BASE_COMPANION, bodyColor: '#1F1535' }).success).toBe(false);
  });
  it.each(['zest', 'Zest Max', 'Z', 'Supercalifragi'])('rejects name %s', (name) => {
    expect(CompanionThemeV1Schema.safeParse({ ...BASE_COMPANION, name }).success).toBe(false);
  });
  it('rejects unknown headpieces (parts are app assets)', () => {
    expect(CompanionThemeV1Schema.safeParse({ ...BASE_COMPANION, headpiece: 'fedora' }).success).toBe(false);
  });
});

describe('LearnerContextV1 and IntakeTurnV1', () => {
  const context = {
    schemaVersion: 1,
    goal: {
      topic: 'mixology',
      statement: 'Host a cocktail night Saturday, with a good non-alcoholic option',
      outcome: 'Fix any drink that tastes off and serve one great non-alcoholic option',
      application: 'A party this Saturday',
    },
    experience: { level: 'new', notes: null },
    horizon: 'quickWin',
    facts: ['Has a shaker and a jigger'],
    constraints: ['One guest does not drink alcohol'],
  };
  it('accepts a complete context and lowercases the topic', () => {
    const parsed = LearnerContextV1Schema.parse({ ...context, goal: { ...context.goal, topic: 'Mixology' } });
    expect(parsed.goal.topic).toBe('mixology');
  });
  it('rejects a learning-style label (we never store one)', () => {
    expect(LearnerContextV1Schema.safeParse({ ...context, learningStyle: 'visual' }).success).toBe(false);
  });
  it('accepts an ask turn and a ready turn', () => {
    expect(IntakeTurnV1Schema.safeParse({ kind: 'ask', question: 'Do you own a shaker?', suggestedAnswers: ['Yes', 'No'] }).success).toBe(true);
    expect(IntakeTurnV1Schema.safeParse({ kind: 'ready', context, summary: 'Got it: a party Saturday, one non-drinker.' }).success).toBe(true);
  });
});
