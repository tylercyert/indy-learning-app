/**
 * Regenerates the stress fixtures at the MAXIMUM LEGAL shape of the current contracts.
 *
 *   npx tsx qa/fixtures/stress/generate.ts
 *
 * Every string length below is taken from the contract bounds, so when a bound is tightened the
 * fixture follows it instead of silently turning invalid. The script refuses to write a fixture
 * that fails validation, and refuses to overwrite the two intentionally invalid fixtures
 * (invalid-garbage, invalid-nodes-close) and the hand-authored adversarial diagram-corners.
 * Render them with qa/render-slide.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CALLOUT_MAX_CHARS, CODE_BLOCK_MAX_COLS, CODE_BLOCK_MAX_LINES, SlideV1Schema, type SlideV1 } from '../../../src/contracts';

const SENTENCE = 'Balance is the whole game: base gives body, acid brightens, sweetness rounds the edges and dilution opens everything up so the flavors can breathe. ';
const LONG_WORD = 'Supercalifragilisticexpialidocious';

/** Exactly n characters of readable prose, never ending in a space (the contract trims). */
function filler(n: number): string {
  const s = SENTENCE.repeat(Math.ceil(n / SENTENCE.length) + 1).slice(0, n);
  return s.endsWith(' ') ? s.slice(0, -1) + 'x' : s;
}
/** Exactly n characters with no break opportunity. */
function nospace(n: number): string {
  return LONG_WORD.repeat(Math.ceil(n / LONG_WORD.length) + 1).slice(0, n);
}
/** Diagram node label at the 28-char cap whose words respect the 14-char word cap. */
const NODE_LABELS = [
  'Supercalifragi listicexpial!',
  'Fresh squeezed citrus acid!!',
  'Simple syrup or honey water!',
  'Dilution: ice, shake, stir..',
  'Aromatics, bitters, herbs...',
  'Temperature and glassware...',
];
const EDGE_LABELS = ['balances against x', 'cuts sweetness fas', 'softens the acid!!', 'opens up aroma....', 'chills and dilutes', 'needs a cold glass', 'finishes the drink', 'supports the base.'];
const COLORS = ['primary', 'secondary', 'accent', 'neutral', 'highlight'] as const;
const SHAPES = ['box', 'circle', 'pill'] as const;

const para = (text: string, marks?: ('bold' | 'italic' | 'code')[]) => ({ type: 'paragraph' as const, inlines: [{ text, ...(marks ? { marks } : {}) }] });

const fixtures: Record<string, SlideV1> = {
  'callout-long': {
    id: 'callout-long',
    title: 'Companion callouts at length',
    purpose: 'orient',
    components: [
      { id: 'c1', type: 'callout', speaker: 'companion', tone: 'explain', content: { blocks: [para(filler(CALLOUT_MAX_CHARS))] } },
      { id: 'c2', type: 'callout', speaker: 'companion', tone: 'warn', content: { blocks: [para(nospace(120))] } },
      { id: 'c3', type: 'callout', speaker: 'companion', tone: 'encourage', content: { blocks: [para('Hi!')] } },
      {
        id: 'c4',
        type: 'callout',
        speaker: 'companion',
        tone: 'celebrate',
        content: {
          // Four blocks (the cap) totalling exactly CALLOUT_MAX_CHARS: 160 + 40×3 + 60 + 60.
          blocks: [
            para(filler(160)),
            { type: 'bulletList', items: [[{ text: filler(40) }], [{ text: filler(40), marks: ['bold'] }], [{ text: nospace(40) }]] },
            para(filler(60), ['italic']),
            { type: 'link', label: filler(60), href: 'https://example.com/long' },
          ],
        },
      },
      {
        id: 'c5',
        type: 'callout',
        speaker: 'plain',
        tone: 'celebrate',
        content: { blocks: [para(filler(CALLOUT_MAX_CHARS - 60)), { type: 'link', label: nospace(60), href: 'https://example.com/long' }] },
      },
    ],
  },

  'checklist-max': {
    id: 'checklist-max',
    title: 'Checklist at maximum bounds',
    purpose: 'wrapUp',
    components: [
      {
        id: 'steps',
        type: 'checklist',
        title: filler(80),
        items: [
          ...Array.from({ length: 7 }, (_, i) => ({ id: `s${i + 1}`, text: `${i + 1}. ${filler(87)}` })),
          { id: 's8', text: nospace(90) },
        ],
        confirmLabel: nospace(22),
      },
    ],
  },

  'choice-max': {
    id: 'choice-max',
    title: 'Quick check at maximum bounds',
    purpose: 'assess',
    components: [
      {
        id: 'q1',
        type: 'multipleChoice',
        prompt: filler(240),
        options: [
          { id: 'a', text: `A) ${filler(87)}`, explanation: filler(300) },
          { id: 'b', text: `B) ${filler(87)}`, explanation: filler(300) },
          { id: 'c', text: `C) ${filler(87)}`, explanation: filler(300) },
          { id: 'd', text: `D) ${filler(87)}`, explanation: filler(300) },
          { id: 'e', text: nospace(90), explanation: filler(300) },
        ],
        correctOptionId: 'c',
      },
    ],
  },

  'diagram-dense-6': {
    id: 'diagram-dense-6',
    title: 'Dense diagram: six nodes, eight labeled edges',
    purpose: 'teach',
    components: [
      {
        id: 'd',
        type: 'diagram',
        title: filler(60),
        nodes: NODE_LABELS.map((label, i) => ({
          id: `n${i + 1}`,
          label,
          shape: SHAPES[i % 3]!,
          x: (i % 3) * 50,
          y: Math.floor(i / 3) * 50,
          color: COLORS[i % 5]!,
        })),
        edges: [
          ['n1', 'n2', 'arrow'],
          ['n2', 'n3', 'line'],
          ['n4', 'n5', 'dashed'],
          ['n5', 'n6', 'arrow'],
          ['n1', 'n4', 'arrow'],
          ['n2', 'n5', 'line'],
          ['n3', 'n6', 'dashed'],
          ['n1', 'n6', 'arrow'],
        ].map(([from, to, style], i) => ({ from: from!, to: to!, label: EDGE_LABELS[i]!, style: style as 'arrow' | 'line' | 'dashed' })),
        altText: filler(240),
      },
    ],
  },

  'diagram-two': {
    id: 'diagram-two',
    title: 'Two-node diagrams: horizontal, vertical, diagonal',
    purpose: 'teach',
    components: [
      {
        id: 'd',
        type: 'diagram',
        title: '',
        nodes: [
          { id: 'a', label: NODE_LABELS[0]!, shape: 'circle', x: 0, y: 50, color: 'primary' },
          { id: 'b', label: NODE_LABELS[1]!, shape: 'pill', x: 100, y: 50, color: 'accent' },
        ],
        edges: [{ from: 'a', to: 'b', label: EDGE_LABELS[0]!, style: 'arrow' }],
        altText: 'Two nodes joined by one labeled edge.',
      },
      {
        id: 'd2',
        type: 'diagram',
        title: 'Vertical pair: the labeled edge is short',
        nodes: [
          { id: 'top', label: 'Top', shape: 'pill', x: 50, y: 0 },
          { id: 'bottom', label: 'Bottom', shape: 'circle', x: 50, y: 100 },
        ],
        edges: [{ from: 'top', to: 'bottom', label: EDGE_LABELS[4]!, style: 'arrow' }],
        altText: 'Top points to bottom.',
      },
      {
        id: 'd3',
        type: 'diagram',
        title: filler(60),
        nodes: [
          { id: 'tl', label: NODE_LABELS[2]!, shape: 'box', x: 0, y: 0, color: 'highlight' },
          { id: 'br', label: NODE_LABELS[3]!, shape: 'box', x: 100, y: 100, color: 'neutral' },
        ],
        edges: [{ from: 'tl', to: 'br', label: '', style: 'line' }],
        altText: filler(240),
      },
    ],
  },

  'diagram-zigzag': {
    id: 'diagram-zigzag',
    title: 'Zigzag chain over three rows (height cap)',
    purpose: 'teach',
    components: [
      {
        id: 'd',
        type: 'diagram',
        title: 'Zigzag chain',
        nodes: NODE_LABELS.map((label, i) => ({
          id: `z${i + 1}`,
          label,
          shape: SHAPES[(i + 1) % 3]!,
          x: (i % 2) * 100,
          y: Math.floor(i / 2) * 50,
          color: COLORS[(i + 2) % 5]!,
        })),
        edges: [
          { from: 'z1', to: 'z2', label: EDGE_LABELS[0]!, style: 'arrow' },
          { from: 'z2', to: 'z3', label: EDGE_LABELS[1]!, style: 'arrow' },
          { from: 'z3', to: 'z4', label: EDGE_LABELS[2]!, style: 'arrow' },
          { from: 'z4', to: 'z5', label: EDGE_LABELS[3]!, style: 'arrow' },
          { from: 'z5', to: 'z6', label: '', style: 'arrow' },
          { from: 'z1', to: 'z3', label: '', style: 'dashed' },
          { from: 'z2', to: 'z4', label: '', style: 'dashed' },
          { from: 'z4', to: 'z6', label: '', style: 'line' },
        ],
        altText: 'Six steps alternate left and right down the page; four edges carry labels.',
      },
    ],
  },

  'floor-counts': {
    id: 'floor-counts',
    title: filler(60),
    purpose: 'teach',
    components: [
      {
        id: 'd',
        type: 'diagram',
        title: 'Two nodes, no edges',
        nodes: [
          { id: 'a', label: 'A', shape: 'pill', x: 100, y: 100, color: 'secondary' },
          { id: 'b', label: 'B', shape: 'box', x: 0, y: 100 },
        ],
        edges: [],
        altText: 'Two unconnected nodes.',
      },
      {
        id: 'r',
        type: 'ratioBar',
        title: 'Two equal parts',
        segments: [
          { label: 'A', parts: 1, color: 'primary' },
          { label: 'B', parts: 1, color: 'accent' },
        ],
        altText: 'One to one.',
      },
      { id: 't', type: 'text', content: { blocks: [para('x')] } },
      { id: 'c', type: 'checklist', title: 'T', items: [{ id: 'one', text: 'x' }], confirmLabel: 'Ok' },
      {
        id: 'q',
        type: 'multipleChoice',
        prompt: 'Short?',
        options: [
          { id: 'a', text: 'A', explanation: 'No.' },
          { id: 'b', text: 'B', explanation: 'Yes.' },
        ],
        correctOptionId: 'b',
      },
    ],
  },

  'mixed-five': {
    id: 'mixed-five',
    title: filler(60),
    purpose: 'practice',
    components: [
      {
        id: 'c1',
        type: 'callout',
        speaker: 'companion',
        tone: 'celebrate',
        content: { blocks: [para(filler(CALLOUT_MAX_CHARS - 160)), { type: 'bulletList', items: [[{ text: filler(80) }], [{ text: filler(80) }]] }] },
      },
      { id: 'c2', type: 'text', content: { blocks: [{ type: 'heading', level: 2, inlines: [{ text: filler(80) }] }, para(filler(600))] } },
      {
        id: 'c3',
        type: 'ratioBar',
        title: 'Five segments including two singletons',
        segments: [
          { label: 'Base', parts: 4, color: 'primary' },
          { label: 'Sour', parts: 1, color: 'accent' },
          { label: 'Sweet', parts: 1, color: 'secondary' },
          { label: 'Dilution water', parts: 5, color: 'neutral' },
          { label: 'Bitters', parts: 2, color: 'highlight' },
        ],
        altText: 'Four parts base, one sour, one sweet, five dilution, two bitters.',
      },
      {
        id: 'c4',
        type: 'diagram',
        title: 'Cycle',
        nodes: [
          { id: 'a', label: 'Taste', shape: 'circle', x: 50, y: 0, color: 'primary' },
          { id: 'b', label: 'Adjust one lever', shape: 'pill', x: 100, y: 100, color: 'accent' },
          { id: 'c', label: 'Taste again', shape: 'box', x: 0, y: 100, color: 'highlight' },
        ],
        edges: [
          { from: 'a', to: 'b', label: 'too sweet?', style: 'arrow' },
          { from: 'b', to: 'c', label: 'stir', style: 'arrow' },
          { from: 'c', to: 'a', label: 'repeat', style: 'dashed' },
        ],
        altText: 'Taste, adjust one lever, taste again, repeat.',
      },
      {
        id: 'c5',
        type: 'multipleChoice',
        prompt: filler(240),
        options: [
          { id: 'a', text: filler(90), explanation: filler(300) },
          { id: 'b', text: filler(60), explanation: filler(300) },
          { id: 'c', text: filler(30), explanation: filler(300) },
        ],
        correctOptionId: 'b',
      },
    ],
  },

  'ratio-six': {
    id: 'ratio-six',
    title: 'Ratio bars: six segments, 6:1, six equal parts',
    purpose: 'teach',
    components: [
      {
        // Six segments at the ratio bounds: lowest terms, total ≤ 16, largest ≤ 6 × smallest.
        id: 'ratio',
        type: 'ratioBar',
        title: filler(60),
        segments: [
          { label: 'Base spirit or cold tea!', parts: 6, color: 'primary' },
          { label: 'Fresh citrus acid juice.', parts: 1, color: 'accent' },
          { label: 'Simple syrup sweeteners.', parts: 3, color: 'secondary' },
          { label: 'Dilution from ice & stir', parts: 4, color: 'neutral' },
          { label: 'Aromatic bitters dash-ed', parts: 1, color: 'highlight' },
          { label: 'Garnish and salt rim too', parts: 1, color: 'primary' },
        ],
        altText: filler(600),
      },
      {
        id: 'ratio-two-extreme',
        type: 'ratioBar',
        title: 'Two segments, 6 : 1 (the widest spread allowed)',
        segments: [
          { label: nospace(24), parts: 6, color: 'highlight' },
          { label: 'one', parts: 1, color: 'secondary' },
        ],
        altText: 'Six parts to one part.',
      },
      {
        id: 'ratio-equal-six',
        type: 'ratioBar',
        title: 'Six equal parts (fractions: 4 of 6 shaded)',
        segments: [
          { label: 'first sixth', parts: 1, color: 'primary' },
          { label: 'second sixth', parts: 1, color: 'primary' },
          { label: 'third sixth', parts: 1, color: 'primary' },
          { label: 'fourth sixth', parts: 1, color: 'primary' },
          { label: 'fifth sixth', parts: 1, color: 'neutral' },
          { label: 'sixth sixth', parts: 1, color: 'neutral' },
        ],
        altText: 'Six equal segments; the first four are shaded to show four sixths.',
      },
    ],
  },

  'text-max-lists': {
    id: 'text-max-lists',
    title: 'Text block: 12-item lists and 60-char links',
    purpose: 'teach',
    components: [
      {
        id: 'body',
        type: 'text',
        content: {
          blocks: [
            // 12 items whose text totals exactly the 600-char block cap.
            { type: 'bulletList', items: Array.from({ length: 12 }, (_, i) => [{ text: `${i + 1}: ${filler(i < 9 ? 47 : 46)}` }]) },
            {
              type: 'numberedList',
              items: [10, 20, 30, 40, 50, 60, 70, 80, 90, 50, 50, 50].map((n, i) => [{ text: filler(n), marks: i % 3 === 0 ? ['bold' as const] : [] }]),
            },
            { type: 'numberedList', items: Array.from({ length: 12 }, () => [{ text: 'Step' }]) },
            { type: 'link', label: filler(60), href: `https://example.com/${'a'.repeat(1980)}` },
            { type: 'link', label: nospace(60), href: 'https://example.com/x' },
          ],
        },
      },
    ],
  },

  'text-max-prose': {
    id: 'text-max-prose',
    title: 'Text block: 20 blocks, 600-char paragraphs, 60 inlines',
    purpose: 'teach',
    components: [
      {
        id: 'body',
        type: 'text',
        content: {
          blocks: [
            { type: 'heading', level: 1, inlines: [{ text: filler(80) }] },
            { type: 'heading', level: 2, inlines: [{ text: filler(80) }] },
            { type: 'heading', level: 3, inlines: [{ text: nospace(80) }] },
            para(filler(600)),
            {
              type: 'paragraph',
              inlines: Array.from({ length: 60 }, (_, i) => ({
                text: i % 2 === 0 ? 'Balance' : ' Balance i ',
                marks: ([['bold'], ['italic'], ['code'], ['bold', 'italic', 'code'], []] as const)[i % 5]!.slice(),
              })),
            },
            { type: 'callout', tone: 'tip', inlines: [{ text: filler(600) }] },
            { type: 'callout', tone: 'warning', inlines: [{ text: nospace(80) }] },
            { type: 'callout', tone: 'note', inlines: [{ text: 'Short note.' }] },
            para(nospace(600), ['code']),
            { type: 'heading', level: 2, inlines: [{ text: 'Eleven more blocks to reach the cap of twenty' }] },
            para(filler(120)),
            { type: 'bulletList', items: [[{ text: filler(40) }], [{ text: filler(40) }]] },
            para(filler(120)),
            { type: 'heading', level: 3, inlines: [{ text: filler(40) }] },
            para(filler(120)),
            { type: 'numberedList', items: [[{ text: filler(40) }], [{ text: filler(40) }]] },
            para(filler(120)),
            { type: 'callout', tone: 'note', inlines: [{ text: filler(120) }] },
            para(filler(120)),
            { type: 'link', label: 'Last block', href: 'https://example.com/end' },
          ],
        },
      },
    ],
  },

  'code-max': {
    id: 'code-max',
    title: 'Code blocks: 16 × 80, deep indentation, blank lines',
    purpose: 'teach',
    components: [
      {
        id: 'wide',
        type: 'codeBlock',
        language: 'typescript',
        // Every line is exactly CODE_BLOCK_MAX_COLS wide; indentation deepens so the scroll is needed.
        lines: Array.from({ length: CODE_BLOCK_MAX_LINES }, (_, i) => {
          const indent = ' '.repeat(Math.min(i, 8) * 2);
          const body = `const step${i + 1} = balance({ base: ${i + 1}, sour: 1, sweet: 1 }); // `;
          return (indent + body).padEnd(CODE_BLOCK_MAX_COLS, 'x').slice(0, CODE_BLOCK_MAX_COLS);
        }),
        caption: filler(80),
      },
      {
        id: 'python',
        type: 'codeBlock',
        language: 'python',
        lines: ['def mix(base, sour, sweet):', '    """Return the ratio as parts."""', '', '    total = base + sour + sweet', '    return base / total, sour / total, sweet / total', '', 'print(mix(2, 1, 1))'],
        caption: 'Blank lines keep their height; indentation is four spaces.',
      },
      { id: 'one', type: 'codeBlock', language: 'bash', lines: ['npm run verify'], caption: '' },
      { id: 'nospace', type: 'codeBlock', language: 'plain', lines: [nospace(CODE_BLOCK_MAX_COLS)], caption: nospace(80) },
    ],
  },

  'fillblank-max': {
    id: 'fillblank-max',
    title: 'Fill the gap: two gaps, long accepted lists',
    purpose: 'practice',
    components: [
      {
        id: 'snippet',
        type: 'codeBlock',
        language: 'sql',
        lines: ['SELECT name, parts', 'FROM ingredients', 'WHERE parts > 1', 'ORDER BY parts DESC;'],
        caption: 'The clause that sorts is the one the gap asks for.',
      },
      {
        id: 'q',
        type: 'fillBlank',
        prompt: filler(160),
        text: `${filler(100)} ___ ${filler(100)} ___ ${filler(30)}`,
        gaps: [
          { id: 'g1', accepted: ['ORDER BY', 'order by clause', 'the ORDER BY clause', nospace(30), 'orderby', 'order-by'], explanation: filler(200) },
          { id: 'g2', accepted: ['acid'], explanation: filler(200) },
        ],
      },
    ],
  },

  'matchpairs-max': {
    id: 'matchpairs-max',
    title: 'Match pairs: five pairs at the length caps',
    purpose: 'practice',
    components: [
      {
        id: 'm',
        type: 'matchPairs',
        prompt: filler(160),
        pairs: [
          { id: 'p1', left: filler(40), right: filler(60), explanation: filler(160) },
          { id: 'p2', left: nospace(40), right: filler(59).replace('Balance', 'Balanced'), explanation: filler(160) },
          { id: 'p3', left: 'Acid', right: 'Cuts sweetness so the drink tastes bright, not syrupy.', explanation: filler(160) },
          { id: 'p4', left: 'Dilution', right: nospace(60), explanation: filler(160) },
          { id: 'p5', left: 'Base', right: 'Body and strength', explanation: 'The base is the spirit or strong tea; it gives body.' },
        ],
      },
    ],
  },

  'void-short': {
    id: 'void-short',
    title: 'A short slide should still feel composed',
    purpose: 'teach',
    components: [
      { id: 'c1', type: 'callout', speaker: 'companion', tone: 'explain', content: { blocks: [para('Here is the one idea behind every great sour drink.')] } },
      { id: 't', type: 'text', content: { blocks: [para('Sugar makes a drink feel heavy. Acid cuts through it so flavors taste bright instead of syrupy.')] } },
      {
        id: 'r',
        type: 'ratioBar',
        title: 'A classic sour, by volume',
        segments: [
          { label: 'base', parts: 2, color: 'primary' },
          { label: 'sour', parts: 1, color: 'accent' },
          { label: 'sweet', parts: 1, color: 'secondary' },
        ],
        altText: 'Two parts base, one part sour, one part sweet.',
      },
    ],
  },

  'title-60': {
    id: 'title-60',
    title: nospace(60),
    purpose: 'orient',
    components: [
      { id: 't', type: 'text', content: { blocks: [para('A short body under a title with no break opportunities.')] } },
      { id: 'c', type: 'checklist', title: nospace(80), items: [{ id: 'one', text: 'One short item' }], confirmLabel: nospace(22) },
    ],
  },
};

const dir = path.dirname(new URL(import.meta.url).pathname);
let failed = false;
for (const [name, slide] of Object.entries(fixtures)) {
  const result = SlideV1Schema.safeParse(slide);
  if (!result.success) {
    failed = true;
    console.error(`NOT WRITTEN ${name}.json:\n  ` + result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  '));
    continue;
  }
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(slide, null, 2) + '\n');
  console.log(`wrote ${name}.json (${slide.components.length} components)`);
}
for (const name of ['invalid-garbage', 'invalid-nodes-close']) {
  const doc: unknown = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  if (SlideV1Schema.safeParse(doc).success) {
    failed = true;
    console.error(`${name}.json is meant to be INVALID but now validates`);
  }
}
if (failed) process.exit(1);
