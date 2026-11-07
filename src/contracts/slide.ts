import { z } from 'zod';
import { ComponentV1Schema, componentRole } from './components';
import { LocalIdSchema, ShortTextSchema, assertUniqueLocalIds } from './ids';

/**
 * SlideV1: one structured unit of instruction, an ordered list of components.
 * `purpose` tells the renderer and the generator what the slide is for; it never changes scoring.
 */
export const SlidePurposeSchema = z.enum(['orient', 'teach', 'practice', 'assess', 'wrapUp']);
export type SlidePurpose = z.infer<typeof SlidePurposeSchema>;

export const SlideV1Schema = z
  .strictObject({
    id: LocalIdSchema,
    title: ShortTextSchema,
    purpose: SlidePurposeSchema,
    components: z.array(ComponentV1Schema).min(1).max(5),
  })
  .superRefine((slide, ctx) => {
    assertUniqueLocalIds(slide.components, ctx, 'component');
    const assessable = slide.components.filter((c) => componentRole(c.type) === 'assessable');
    if (assessable.length > 1) {
      ctx.addIssue({ code: 'custom', message: 'at most one assessable component per slide', path: ['components'] });
    }
  });
export type SlideV1 = z.infer<typeof SlideV1Schema>;

export function slideHasAssessable(slide: SlideV1): boolean {
  return slide.components.some((c) => componentRole(c.type) === 'assessable');
}
