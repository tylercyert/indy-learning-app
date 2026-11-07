import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE_COMPANION,
  CALLOUT_MAX_BLOCKS,
  CALLOUT_MAX_CHARS,
  CompanionThemeV1Schema,
  ComponentV1Schema,
  CoursePlanV1Schema,
  GeneratedSlidesV1Schema,
  IntakeTurnV1Schema,
  LearnerContextV1Schema,
  ProgressionRuleV1Schema,
  RICH_TEXT_MAX_BLOCK_CHARS,
  RICH_TEXT_MAX_HEADING_CHARS,
  RichTextV1Schema,
  SkillTreeV1Schema,
  SlideV1Schema,
  richTextChars,
  richTextToPlain,
} from './index';
import { examplePlan, exampleSlides, exampleTree } from './examples';

const paragraph = (text: string) => ({ type: 'paragraph' as const, inlines: [{ text }] });

describe('RichTextV1', () => {
  it('accepts headings, lists and marked inlines', () => {
    const doc = RichTextV1Schema.parse({
      blocks: [
        { type: 'heading', level: 2, inlines: [{ text: 'Why acid' }] },
        { type: 'bulletList', items: [[{ text: 'cuts sweet', marks: ['bold'] }], [{ text: 'adds brightness' }]] },
        { type: 'link', label: 'Read more', href: 'https://example.com/acid' },
      ],
    });
    expect(richTextToPlain(doc)).toBe('Why acid\ncuts sweet\nadds brightness\nRead more');
  });
  it.each(['http://example.com', 'javascript:alert(1)', 'https://'])('rejects non-https link %s', (href) => {
    const result = RichTextV1Schema.safeParse({ blocks: [{ type: 'link', label: 'x', href }] });
    expect(result.success).toBe(false);
  });
  it('rejects links hidden on inlines (links are their own block)', () => {
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'paragraph', inlines: [{ text: 'x', href: 'https://example.com' }] }] }).success).toBe(false);
  });
  it('rejects unknown block types and raw html fields', () => {
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'html', html: '<b>x</b>' }] }).success).toBe(false);
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'paragraph', inlines: [{ text: 'x' }], html: '<b>' }] }).success).toBe(false);
  });
  it('caps a block at the phone-readable length and a heading shorter still', () => {
    expect(RichTextV1Schema.safeParse({ blocks: [paragraph('x'.repeat(RICH_TEXT_MAX_BLOCK_CHARS))] }).success).toBe(true);
    expect(RichTextV1Schema.safeParse({ blocks: [paragraph('x'.repeat(RICH_TEXT_MAX_BLOCK_CHARS + 1))] }).success).toBe(false);
    const heading = (n: number) => ({ type: 'heading' as const, level: 2 as const, inlines: [{ text: 'x'.repeat(n) }] });
    expect(RichTextV1Schema.safeParse({ blocks: [heading(RICH_TEXT_MAX_HEADING_CHARS)] }).success).toBe(true);
    expect(RichTextV1Schema.safeParse({ blocks: [heading(RICH_TEXT_MAX_HEADING_CHARS + 1)] }).success).toBe(false);
  });
  it('counts list items together against one block limit', () => {
    const items = Array.from({ length: 12 }, () => [{ text: 'x'.repeat(51) }]);
    expect(RichTextV1Schema.safeParse({ blocks: [{ type: 'bulletList', items }] }).success).toBe(false);
    expect(richTextChars({ blocks: [{ type: 'bulletList', items: items.slice(0, 2) }, paragraph('abc')] })).toBe(105);
  });
});

describe('callout component', () => {
  const callout = (blocks: unknown[]) => ({ id: 'c', type: 'callout', speaker: 'companion', tone: 'explain', content: { blocks } });
  it('accepts a bubble at the character cap across several blocks', () => {
    const ok = callout([paragraph('x'.repeat(200)), { type: 'bulletList', items: [[{ text: 'y'.repeat(100) }]] }, paragraph('z'.repeat(100))]);
    expect(ComponentV1Schema.safeParse(ok).success).toBe(true);
  });
  it('rejects more than the character cap even when each block is legal on its own', () => {
    const result = ComponentV1Schema.safeParse(callout([paragraph('x'.repeat(300)), paragraph('y'.repeat(CALLOUT_MAX_CHARS - 300 + 1))]));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('speech bubble'))).toBe(true);
  });
  it('rejects headings inside a callout', () => {
    const result = ComponentV1Schema.safeParse(callout([{ type: 'heading', level: 2, inlines: [{ text: 'Shout' }] }, paragraph('x')]));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message.includes('headings'))).toBe(true);
  });
  it('rejects more blocks than a bubble holds', () => {
    const tooMany = callout(Array.from({ length: CALLOUT_MAX_BLOCKS + 1 }, (_, i) => paragraph(`p${i}`)));
    expect(ComponentV1Schema.safeParse(tooMany).success).toBe(false);
    expect(ComponentV1Schema.safeParse(callout(Array.from({ length: CALLOUT_MAX_BLOCKS }, (_, i) => paragraph(`p${i}`)))).success).toBe(true);
  });
});

describe('diagram component', () => {
  const node = (id: string, x: number, y: number, label = id) => ({ id, label, shape: 'box', x, y });
  const diagram = (nodes: unknown[], edges: unknown[] = []) => ({ id: 'd', type: 'diagram', nodes, edges, altText: 'alt' });
  it('needs at least two nodes', () => {
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0)])).success).toBe(false);
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0), node('b', 50, 0)])).success).toBe(true);
  });
  it('rejects a node label with a word longer than 14 characters', () => {
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0, 'Supercalifragilistic'), node('b', 50, 0)])).success).toBe(false);
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0, 'Supercalifragi listicexpial!'), node('b', 50, 0)])).success).toBe(true);
  });
  it('rejects two edges between the same pair, in either direction', () => {
    const nodes = [node('a', 0, 0), node('b', 50, 0)];
    expect(ComponentV1Schema.safeParse(diagram(nodes, [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }])).success).toBe(false);
  });
  it('rejects nodes closer than the grid minimum unless separated on the other axis', () => {
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0), node('b', 49, 33)])).success).toBe(false);
    expect(ComponentV1Schema.safeParse(diagram([node('a', 0, 0), node('b', 0, 34)])).success).toBe(true);
  });
});

describe('stress fixtures', () => {
  // vitest runs from the repo root (see vitest.config.mts include globs).
  const dir = path.resolve(process.cwd(), 'qa/fixtures/stress');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  it.each(files)('%s validates exactly when its name says so', (file) => {
    const doc: unknown = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    expect(SlideV1Schema.safeParse(doc).success).toBe(!file.startsWith('invalid-'));
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
  it('requires kind "optional" and required=false to agree', () => {
    const nodes = exampleTree.nodes.map((n) => (n.id === 'non-alc' ? { ...n, required: true } : n));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes }).success).toBe(false);
    const nodes2 = exampleTree.nodes.map((n) => (n.id === 'dilution' ? { ...n, required: false } : n));
    expect(SkillTreeV1Schema.safeParse({ ...exampleTree, nodes: nodes2 }).success).toBe(false);
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
