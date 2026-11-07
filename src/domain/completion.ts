import type { ComponentResultV1, LearningExperienceV1 } from '../contracts';
import { componentRole } from '../contracts/components';

/**
 * A learning experience is complete when every slide has been viewed and every assessable
 * component has at least one recorded result. Being wrong never blocks completion.
 */
export function isExperienceComplete(
  experience: LearningExperienceV1,
  viewedSlideIds: ReadonlySet<string>,
  results: readonly ComponentResultV1[],
): boolean {
  if (!experience.slides.every((s) => viewedSlideIds.has(s.id))) return false;
  const answered = new Set(results.map((r) => r.componentId));
  for (const slide of experience.slides) {
    for (const component of slide.components) {
      if (componentRole(component.type) === 'assessable' && !answered.has(component.id)) return false;
    }
  }
  return true;
}

export function remainingAssessables(
  experience: LearningExperienceV1,
  results: readonly ComponentResultV1[],
): string[] {
  const answered = new Set(results.map((r) => r.componentId));
  return experience.slides
    .flatMap((s) => s.components)
    .filter((c) => componentRole(c.type) === 'assessable' && !answered.has(c.id))
    .map((c) => c.id);
}
