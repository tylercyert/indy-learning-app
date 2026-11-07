import { z } from 'zod';

/**
 * CompanionThemeV1: the costume and name for a course's companion.
 * The body, eyes, mouth and moods are fixed app assets; the model only proposes these tokens.
 * Any validation failure falls back to BASE_COMPANION, so a course never lacks a companion.
 */
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex color like #FF7A59');

export const CompanionHeadpieceSchema = z.enum([
  'none', 'sprig', 'chefHat', 'antenna', 'beanie', 'headphones', 'leaf', 'crown', 'glasses', 'bandana',
]);
export const CompanionPropSchema = z.enum([
  'none', 'umbrella', 'whisk', 'wrench', 'book', 'coin', 'brush', 'racket', 'guitar', 'flag',
]);
export const CompanionMoodSchema = z.enum(['happy', 'curious', 'thinking', 'cheering']);
export type CompanionMood = z.infer<typeof CompanionMoodSchema>;

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export const CompanionThemeV1Schema = z
  .strictObject({
    schemaVersion: z.literal(1),
    /** One capitalized word, e.g. "Zest", "Crumb", "Volt". */
    name: z.string().regex(/^[A-Z][a-z]{1,9}$/, 'one capitalized word, 2-10 letters'),
    bodyColor: Hex,
    cheekColor: Hex,
    accentColor: Hex,
    headpiece: CompanionHeadpieceSchema,
    prop: CompanionPropSchema,
    /** Shown once on the home screen as the companion's greeting. */
    greeting: z.string().trim().min(1).max(80),
  })
  .refine((t) => relativeLuminance(t.bodyColor) >= 0.18, {
    message: 'body color too dark for ink features',
    path: ['bodyColor'],
  });
export type CompanionThemeV1 = z.infer<typeof CompanionThemeV1Schema>;

export const BASE_COMPANION: CompanionThemeV1 = {
  schemaVersion: 1,
  name: 'Pip',
  bodyColor: '#A78BFA',
  cheekColor: '#DDD6FE',
  accentColor: '#6D28D9',
  headpiece: 'none',
  prop: 'none',
  greeting: 'Ready when you are.',
};
