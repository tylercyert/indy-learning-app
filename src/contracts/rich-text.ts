import { z } from 'zod';
import { ShortTextSchema } from './ids';

/**
 * RichTextV1: the only text format a model may put in front of a learner.
 * It is a structured document, never markup. Renderers map blocks and marks to native UI.
 * Links are their own block, https-only, and open outside the app.
 *
 * Schema-shape note: the structured-output API caps optional and union-typed properties, and
 * inlines this schema once per use. So inlines carry no unions and no nullable fields;
 * `marks` is optional for hand-authored content but required (possibly empty) in generation.
 */
export const InlineMarkSchema = z.enum(['bold', 'italic', 'code']);

export const InlineV1Schema = z.strictObject({
  text: z.string().min(1).max(2000),
  marks: z.array(InlineMarkSchema).max(3).optional(),
});
export type InlineV1 = z.infer<typeof InlineV1Schema>;

const InlinesSchema = z.array(InlineV1Schema).min(1).max(60);

export const HeadingBlockSchema = z.strictObject({
  type: z.literal('heading'),
  level: z.literal([1, 2, 3]),
  inlines: InlinesSchema,
});

export const ParagraphBlockSchema = z.strictObject({
  type: z.literal('paragraph'),
  inlines: InlinesSchema,
});

export const BulletListBlockSchema = z.strictObject({
  type: z.literal('bulletList'),
  items: z.array(InlinesSchema).min(1).max(12),
});

export const NumberedListBlockSchema = z.strictObject({
  type: z.literal('numberedList'),
  items: z.array(InlinesSchema).min(1).max(12),
});

export const CalloutBlockSchema = z.strictObject({
  type: z.literal('callout'),
  tone: z.enum(['tip', 'note', 'warning']),
  inlines: InlinesSchema,
});

export const LinkBlockSchema = z.strictObject({
  type: z.literal('link'),
  label: ShortTextSchema.max(60),
  href: z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(2000),
});

export const RichTextBlockV1Schema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  BulletListBlockSchema,
  NumberedListBlockSchema,
  CalloutBlockSchema,
  LinkBlockSchema,
]);
export type RichTextBlockV1 = z.infer<typeof RichTextBlockV1Schema>;

/** Readable on a phone: a block's text stays under ~600 characters, headings under 80. */
export const RICH_TEXT_MAX_BLOCK_CHARS = 600;
export const RICH_TEXT_MAX_HEADING_CHARS = 80;

function blockChars(block: RichTextBlockV1): number {
  switch (block.type) {
    case 'bulletList':
    case 'numberedList':
      return block.items.reduce((n, item) => n + item.reduce((m, i) => m + i.text.length, 0), 0);
    case 'link':
      return block.label.length;
    default:
      return block.inlines.reduce((n, i) => n + i.text.length, 0);
  }
}

export const RichTextV1Schema = z
  .strictObject({
    blocks: z.array(RichTextBlockV1Schema).min(1).max(20),
  })
  .superRefine((doc, ctx) => {
    doc.blocks.forEach((block, index) => {
      const chars = blockChars(block);
      const limit = block.type === 'heading' ? RICH_TEXT_MAX_HEADING_CHARS : RICH_TEXT_MAX_BLOCK_CHARS;
      if (chars > limit) {
        ctx.addIssue({ code: 'custom', message: `${block.type} is ${chars} characters; keep each block under ${limit} and split long ideas across slides`, path: ['blocks', index] });
      }
    });
  });
export type RichTextV1 = z.infer<typeof RichTextV1Schema>;

/** Convenience for tests and fixtures: one paragraph of plain text. */
export function plainParagraph(text: string): RichTextV1 {
  return { blocks: [{ type: 'paragraph', inlines: [{ text }] }] };
}

/** Flattens rich text to a plain string for accessibility labels and search. */
export function richTextToPlain(doc: RichTextV1): string {
  return doc.blocks
    .map((block) => {
      switch (block.type) {
        case 'bulletList':
        case 'numberedList':
          return block.items.map((item) => item.map((inline) => inline.text).join('')).join('\n');
        case 'link':
          return block.label;
        default:
          return block.inlines.map((inline) => inline.text).join('');
      }
    })
    .join('\n');
}
