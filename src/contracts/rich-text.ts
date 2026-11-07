import { z } from 'zod';

/**
 * RichTextV1: the only text format a model may put in front of a learner.
 * It is a structured document, never markup. Renderers map blocks and marks to native UI.
 * Links are https-only and open outside the app.
 */
export const InlineMarkSchema = z.enum(['bold', 'italic', 'code']);

export const InlineV1Schema = z.strictObject({
  text: z.string().min(1).max(2000),
  marks: z.array(InlineMarkSchema).max(3).optional(),
  href: z
    .url({ protocol: /^https$/, hostname: z.regexes.domain })
    .max(2000)
    .optional(),
});
export type InlineV1 = z.infer<typeof InlineV1Schema>;

const InlinesSchema = z.array(InlineV1Schema).min(1).max(60);

export const HeadingBlockSchema = z.strictObject({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
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

export const RichTextBlockV1Schema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  BulletListBlockSchema,
  NumberedListBlockSchema,
  CalloutBlockSchema,
]);
export type RichTextBlockV1 = z.infer<typeof RichTextBlockV1Schema>;

export const RichTextV1Schema = z.strictObject({
  blocks: z.array(RichTextBlockV1Schema).min(1).max(40),
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
        default:
          return block.inlines.map((inline) => inline.text).join('');
      }
    })
    .join('\n');
}
