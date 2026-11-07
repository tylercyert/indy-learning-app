import { z } from 'zod';

/** Onboarding preferences are self-reported, not evidence of mastery. */
export const LearningPreferencesV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  goal: z.string().trim().min(1).max(500),
  experience: z.enum(['beginner', 'some-experience', 'level-up']),
  pace: z.enum(['gentle', 'standard', 'intensive']),
});

export type LearningPreferencesV1 = z.infer<typeof LearningPreferencesV1Schema>;
