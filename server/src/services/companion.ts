import { CompanionThemeV1Schema, type CompanionThemeV1, type CourseV1 } from '../../../src/contracts';
import { generateStructured } from '../ai/claude';
import { COMPANION_SYSTEM, companionUserMessage } from '../ai/prompts';
import * as repo from './repo';

/** Learners own their companion: rename freely, or ask for a new one for this course. */
export function renameCompanion(learnerId: string, courseId: string, name: string): CourseV1 {
  const course = repo.getCourse(learnerId, courseId);
  const companion = CompanionThemeV1Schema.parse({ ...course.companion, name });
  const updated: CourseV1 = { ...course, companion, updatedAt: new Date().toISOString() };
  repo.saveCourse(updated);
  return updated;
}

export async function rerollCompanion(learnerId: string, courseId: string): Promise<CourseV1> {
  const course = repo.getCourse(learnerId, courseId);
  const { data } = await generateStructured({
    task: 'companion-reroll',
    schema: CompanionThemeV1Schema,
    system: COMPANION_SYSTEM,
    messages: [{ role: 'user', content: companionUserMessage(course) }],
    effort: 'low',
    maxTokens: 2000,
  });
  const updated: CourseV1 = { ...course, companion: data as CompanionThemeV1, updatedAt: new Date().toISOString() };
  repo.saveCourse(updated);
  return updated;
}
