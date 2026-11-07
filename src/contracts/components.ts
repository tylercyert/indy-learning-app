import { z } from 'zod';
import { LocalIdSchema, MediumTextSchema, ShortTextSchema, assertUniqueLocalIds } from './ids';
import { RichTextV1Schema } from './rich-text';

/**
 * The educational component catalog. A slide is an ordered list of these.
 *
 * Every component declares a role:
 *   presentational: shows something, produces no result
 *   interactive:    the learner does something, result is recorded but never scored
 *   assessable:     the learner answers, result is scored by code in src/domain
 *
 * Adding a component today = add a schema here, a manifest entry in COMPONENT_MANIFESTS,
 * a renderer in src/features/components, and (if assessable) a scorer in src/domain.
 * Planned (issue #8): one folder per component with its own schema/manifest/renderer/test and a
 * registry, so a sub-agent can add one without touching this file.
 */
export const ComponentRoleSchema = z.enum(['presentational', 'interactive', 'assessable']);
export type ComponentRole = z.infer<typeof ComponentRoleSchema>;

const Base = { id: LocalIdSchema };

// ---------- presentational ----------

export const TextComponentSchema = z.strictObject({
  ...Base,
  type: z.literal('text'),
  content: RichTextV1Schema,
});

export const CalloutComponentSchema = z.strictObject({
  ...Base,
  type: z.literal('callout'),
  /** 'companion' renders as the course companion speaking; 'plain' is a neutral highlighted box. */
  speaker: z.enum(['companion', 'plain']),
  tone: z.enum(['encourage', 'explain', 'warn', 'celebrate']),
  content: RichTextV1Schema,
});

export const RatioSegmentSchema = z.strictObject({
  label: ShortTextSchema.max(24),
  parts: z.int().min(1).max(12),
  /** Named palette slot, mapped to theme colors by the renderer. Never a raw hex from the model. */
  color: z.enum(['primary', 'secondary', 'accent', 'neutral', 'highlight']),
});

export const RatioBarComponentSchema = z
  .strictObject({
    ...Base,
    type: z.literal('ratioBar'),
    title: ShortTextSchema.max(60),
    segments: z.array(RatioSegmentSchema).min(2).max(6),
    /** Required nonvisual explanation. */
    altText: MediumTextSchema,
  })
  .superRefine((value, ctx) => {
    const labels = new Set(value.segments.map((s) => s.label.toLowerCase()));
    if (labels.size !== value.segments.length) {
      ctx.addIssue({ code: 'custom', message: 'segment labels must be unique', path: ['segments'] });
    }
  });

/**
 * Minimum separation between diagram nodes on the 0-100 grid. The renderer lays nodes out
 * ordinally (distinct x → columns, distinct y → rows), so these bounds mainly keep the model
 * from proposing more than 3 columns or 3 rows.
 */
export const DIAGRAM_MIN_DX = 50;
export const DIAGRAM_MIN_DY = 34;

export const DiagramNodeSchema = z.strictObject({
  id: LocalIdSchema,
  /** Short: it must fit a small box on a phone. No single word longer than 14 characters. */
  label: ShortTextSchema.max(28).refine((s) => s.split(/\s+/).every((w) => w.length <= 14), 'no word longer than 14 characters'),
  shape: z.enum(['box', 'circle', 'pill']),
  /** Position on a 0-100 grid; the renderer scales to the slide. */
  x: z.int().min(0).max(100),
  y: z.int().min(0).max(100),
  /** Optional for authored content; generation always supplies it (output schema requires every property). */
  color: z.enum(['primary', 'secondary', 'accent', 'neutral', 'highlight']).optional(),
});

export const DiagramEdgeSchema = z.strictObject({
  from: LocalIdSchema,
  to: LocalIdSchema,
  /** Empty string means no label; keeps the field union-free for generation. */
  label: z.string().trim().max(18).optional(),
  style: z.enum(['arrow', 'line', 'dashed']).optional(),
});

export const DiagramComponentSchema = z
  .strictObject({
    ...Base,
    type: z.literal('diagram'),
    /** Empty string means no title. */
    title: z.string().trim().max(60).optional(),
    nodes: z.array(DiagramNodeSchema).min(2).max(6),
    edges: z.array(DiagramEdgeSchema).max(8),
    /** Spoken by screen readers and shown under the diagram when short. */
    altText: MediumTextSchema.max(240),
  })
  .superRefine((value, ctx) => {
    assertUniqueLocalIds(value.nodes, ctx, 'diagram node');
    const ids = new Set(value.nodes.map((n) => n.id));
    const pairs = new Set<string>();
    value.edges.forEach((edge, index) => {
      const pair = [edge.from, edge.to].sort().join('|');
      if (pairs.has(pair)) {
        ctx.addIssue({ code: 'custom', message: 'only one edge between the same two nodes', path: ['edges', index] });
      }
      pairs.add(pair);
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        ctx.addIssue({ code: 'custom', message: 'edge references unknown node', path: ['edges', index] });
      }
      if (edge.from === edge.to) {
        ctx.addIssue({ code: 'custom', message: 'edge cannot connect a node to itself', path: ['edges', index] });
      }
    });
    for (const [a, b] of diagramCollisions(value.nodes)) {
      ctx.addIssue({
        code: 'custom',
        message: `nodes "${a}" and "${b}" are too close; keep at least ${DIAGRAM_MIN_DX} apart on x or ${DIAGRAM_MIN_DY} apart on y`,
        path: ['nodes'],
      });
    }
  });

/** Pairs of node ids that would overlap when drawn. Empty means the layout is readable. */
export function diagramCollisions(nodes: readonly { id: string; x: number; y: number }[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (Math.abs(a.x - b.x) < DIAGRAM_MIN_DX && Math.abs(a.y - b.y) < DIAGRAM_MIN_DY) out.push([a.id, b.id]);
    }
  }
  return out;
}

// ---------- interactive ----------

export const ChecklistItemSchema = z.strictObject({ id: LocalIdSchema, text: ShortTextSchema.max(90) });

export const ChecklistComponentSchema = z
  .strictObject({
    ...Base,
    type: z.literal('checklist'),
    title: ShortTextSchema.max(80),
    /** Real-world steps the learner performs away from the screen. Self-reported, never scored. */
    items: z.array(ChecklistItemSchema).min(1).max(8),
    confirmLabel: ShortTextSchema.max(22),
  })
  .superRefine((value, ctx) => assertUniqueLocalIds(value.items, ctx, 'checklist item'));

export const ChecklistResultSchema = z.strictObject({
  type: z.literal('checklist'),
  componentId: LocalIdSchema,
  checkedItemIds: z.array(LocalIdSchema).max(8),
  confirmed: z.boolean(),
});

// ---------- assessable ----------

export const ChoiceOptionSchema = z.strictObject({
  id: LocalIdSchema,
  text: ShortTextSchema.max(90),
  /** Shown when THIS option is picked. Wrong options must teach, not just mark. */
  explanation: MediumTextSchema.max(300),
});

export const MultipleChoiceComponentSchema = z
  .strictObject({
    ...Base,
    type: z.literal('multipleChoice'),
    prompt: MediumTextSchema.max(240),
    options: z.array(ChoiceOptionSchema).min(2).max(5),
    correctOptionId: LocalIdSchema,
  })
  .superRefine((value, ctx) => {
    assertUniqueLocalIds(value.options, ctx, 'option');
    if (!value.options.some((o) => o.id === value.correctOptionId)) {
      ctx.addIssue({ code: 'custom', message: 'correctOptionId must match an option', path: ['correctOptionId'] });
    }
  });

export const MultipleChoiceResultSchema = z.strictObject({
  type: z.literal('multipleChoice'),
  componentId: LocalIdSchema,
  selectedOptionId: LocalIdSchema,
  correct: z.boolean(),
  attempt: z.int().min(1),
});

// ---------- unions and manifests ----------

export const ComponentV1Schema = z.discriminatedUnion('type', [
  TextComponentSchema,
  CalloutComponentSchema,
  RatioBarComponentSchema,
  DiagramComponentSchema,
  ChecklistComponentSchema,
  MultipleChoiceComponentSchema,
]);
export type ComponentV1 = z.infer<typeof ComponentV1Schema>;
export type ComponentType = ComponentV1['type'];

export const ComponentResultV1Schema = z.discriminatedUnion('type', [
  ChecklistResultSchema,
  MultipleChoiceResultSchema,
]);
export type ComponentResultV1 = z.infer<typeof ComponentResultV1Schema>;

export interface ComponentManifest {
  type: ComponentType;
  role: ComponentRole;
  /** One sentence the generator reads to decide when to use it. */
  whenToUse: string;
}

export const COMPONENT_MANIFESTS: Readonly<Record<ComponentType, ComponentManifest>> = {
  text: {
    type: 'text',
    role: 'presentational',
    whenToUse: 'Explain an idea in prose, headings and lists. The default teaching block.',
  },
  callout: {
    type: 'callout',
    role: 'presentational',
    whenToUse: 'Have the companion speak: encouragement, a key point, a warning, or a celebration.',
  },
  ratioBar: {
    type: 'ratioBar',
    role: 'presentational',
    whenToUse: 'Show proportions between 2-6 parts of a whole (recipes, budgets, time splits).',
  },
  diagram: {
    type: 'diagram',
    role: 'presentational',
    whenToUse: 'Show how a few named things relate: flows, cycles, hierarchies. Max 12 nodes.',
  },
  checklist: {
    type: 'checklist',
    role: 'interactive',
    whenToUse: 'Ask the learner to do real-world steps away from the screen and confirm. Never scored.',
  },
  multipleChoice: {
    type: 'multipleChoice',
    role: 'assessable',
    whenToUse: 'Check understanding with one correct answer and a teaching explanation per option.',
  },
};

export function componentRole(type: ComponentType): ComponentRole {
  return COMPONENT_MANIFESTS[type].role;
}
