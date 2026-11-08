import type { CompanionMood, CompanionThemeV1 } from '../../contracts';

/**
 * How each fixed mood is said out loud. The mood tokens are UI vocabulary ("cheering"); a screen
 * reader should hear what the companion is doing, as a person would describe it (#20).
 */
export const MOOD_PHRASE: Record<CompanionMood, string> = {
  happy: 'smiling',
  curious: 'looking curious',
  thinking: 'thinking it over',
  cheering: 'cheering you on',
};

const HEADPIECE_LABEL: Record<Exclude<CompanionThemeV1['headpiece'], 'none'>, string> = {
  sprig: 'a sprig',
  chefHat: 'a chef hat',
  antenna: 'an antenna',
  beanie: 'a beanie',
  headphones: 'headphones',
  leaf: 'a leaf',
  crown: 'a crown',
  glasses: 'glasses',
  bandana: 'a bandana',
};

/**
 * Nonvisual description, e.g. "Zest, your companion, smiling, wearing a sprig". Props are part of the
 * contract but are not rendered (owner decision 2026-11-07), so they are not described either.
 */
export function describeCompanion(theme: CompanionThemeV1, mood: CompanionMood): string {
  const parts = [`${theme.name}, your companion`, MOOD_PHRASE[mood]];
  if (theme.headpiece !== 'none') parts.push(`wearing ${HEADPIECE_LABEL[theme.headpiece]}`);
  return parts.join(', ');
}

/** The face alone (app icon): name and mood, e.g. "Poko, smiling". */
export function describeCompanionFace(theme: CompanionThemeV1, mood: CompanionMood): string {
  return `${theme.name}, ${MOOD_PHRASE[mood]}`;
}
