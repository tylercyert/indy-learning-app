import { z } from 'zod';

/**
 * EntityId: server-assigned identity for stored things (learners, courses, lessons...).
 * LocalId: model- or author-assigned identity inside one document (a slide, a node, an option).
 * LocalIds only need to be unique within their document; validation refines enforce that.
 */
export const EntityIdSchema = z.uuid();
export type EntityId = z.infer<typeof EntityIdSchema>;

export const LocalIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'lowercase letters, digits and hyphens, 1-63 chars');
export type LocalId = z.infer<typeof LocalIdSchema>;

export const IsoDateTimeSchema = z.iso.datetime();
export const IsoDateSchema = z.iso.date();

/** Short human-readable text fields produced by generation. Trimmed, bounded. */
export const ShortTextSchema = z.string().trim().min(1).max(120);
export const MediumTextSchema = z.string().trim().min(1).max(600);
export const LongTextSchema = z.string().trim().min(1).max(4000);

export function assertUniqueLocalIds(
  items: readonly { id: string }[],
  ctx: z.core.$RefinementCtx,
  label: string,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: 'custom', message: `duplicate ${label} id "${item.id}"`, path: [index, 'id'] });
    }
    seen.add(item.id);
  });
}
