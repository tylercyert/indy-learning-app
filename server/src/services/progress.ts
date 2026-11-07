import { randomUUID } from 'node:crypto';
import {
  type ComponentResultV1,
  type CourseList,
  type CourseView,
  type ExperienceEventRequest,
  type ExperienceEventResponse,
  type ExperienceView,
  type HistoryEventV1,
  type LearningExperienceV1,
  type TreeView,
} from '../../../src/contracts';
import {
  deriveNodeStates,
  isExperienceComplete,
  isTreeComplete,
  nextNode,
  recordActivity,
  scoreMultipleChoice,
  toLocalDate,
  treeProgress,
} from '../../../src/domain';
import { db } from '../db/client';
import { isGenerating, prefetchAvailable } from './experiences';
import * as repo from './repo';

export function treeView(
  tree: Parameters<typeof deriveNodeStates>[0],
  completed: Set<string>,
  readyLessonIds: Set<string> = new Set(),
  learnerId?: string,
): TreeView {
  return {
    tree,
    nodeStates: deriveNodeStates(tree, completed),
    nextNodeId: nextNode(tree, completed)?.id ?? null,
    progress: treeProgress(tree, completed),
    complete: isTreeComplete(tree, completed),
    readyNodeIds: tree.nodes.filter((n) => readyLessonIds.has(n.lessonId)).map((n) => n.id),
    generatingNodeIds: learnerId ? tree.nodes.filter((n) => isGenerating(learnerId, tree.courseId, n.lessonId)).map((n) => n.id) : [],
  };
}

export function courseView(learnerId: string, courseId: string): CourseView {
  const course = repo.getCourse(learnerId, courseId);
  const completed = repo.completedLessonIds(learnerId);
  const ready = repo.experienceLessonIds(learnerId, courseId);
  const trees = repo.getTrees(courseId).map((t) => treeView(t, completed, ready, learnerId));
  return { course, trees, streak: repo.getStreak(learnerId) };
}

export function courseList(learnerId: string): CourseList {
  const completed = repo.completedLessonIds(learnerId);
  const summaries = repo.listCourses(learnerId).map((course) => {
    const trees = repo.getTrees(course.id);
    const current = trees[trees.length - 1];
    const progress = current ? treeProgress(current, completed) : { completed: 0, required: 0, total: 0 };
    const next = current ? nextNode(current, completed) : null;
    return { course, progress, nextNodeTitle: next?.title ?? null };
  });
  return { courses: summaries, streak: repo.getStreak(learnerId) };
}

function latestResults(events: HistoryEventV1[]): ComponentResultV1[] {
  const byComponent = new Map<string, ComponentResultV1>();
  for (const e of events) if (e.type === 'componentAnswered') byComponent.set(e.result.componentId, e.result);
  return [...byComponent.values()];
}

function viewedSlides(events: HistoryEventV1[]): Set<string> {
  return new Set(events.filter((e) => e.type === 'slideViewed').map((e) => e.slideId));
}

export function experienceView(learnerId: string, experience: LearningExperienceV1): ExperienceView {
  const events = repo.eventsForExperience(learnerId, experience.id);
  const results = latestResults(events);
  const viewed = viewedSlides(events);
  return {
    experience,
    viewedSlideIds: [...viewed],
    results,
    completed: repo.hasCompletion(learnerId, experience.lessonId),
  };
}

/**
 * Records one learner action, scores it if it is an answer, and detects lesson,
 * tree and course completion. All scoring and progression is pure domain code.
 */
export function recordEvent(learnerId: string, experienceId: string, req: ExperienceEventRequest): ExperienceEventResponse {
  const experience = repo.getExperience(learnerId, experienceId);
  const now = new Date().toISOString();
  const today = req.localDate ?? toLocalDate(new Date());
  const slide = experience.slides.find((s) => s.id === req.slideId);
  if (!slide) throw new repo.NotFoundError('slide');

  let scored: ExperienceEventResponse['scored'] = null;
  const base = { id: randomUUID(), learnerId, courseId: experience.courseId, lessonId: experience.lessonId, experienceId, at: now };
  const priorEvents = repo.eventsForExperience(learnerId, experienceId);

  let event: HistoryEventV1;
  if (req.type === 'slideViewed') {
    event = { ...base, type: 'slideViewed', slideId: req.slideId };
  } else if (req.type === 'answer') {
    const component = slide.components.find((c) => c.id === req.componentId);
    if (!component || component.type !== 'multipleChoice') throw new repo.NotFoundError('multipleChoice component');
    const attempt =
      priorEvents.filter((e) => e.type === 'componentAnswered' && e.result.componentId === component.id).length + 1;
    const s = scoreMultipleChoice(component, req.selectedOptionId, attempt);
    scored = { correct: s.result.correct, explanation: s.explanation, correctOptionId: s.correctOptionId, attempt };
    event = { ...base, type: 'componentAnswered', slideId: req.slideId, result: s.result };
  } else {
    const component = slide.components.find((c) => c.id === req.componentId);
    if (!component || component.type !== 'checklist') throw new repo.NotFoundError('checklist component');
    event = {
      ...base,
      type: 'componentAnswered',
      slideId: req.slideId,
      result: { type: 'checklist', componentId: component.id, checkedItemIds: req.checkedItemIds, confirmed: req.confirmed },
    };
  }

  let lessonCompleted = false;
  let treeCompleted = false;

  db.transaction(() => {
    repo.appendEvent(event);
    const events = [...priorEvents, event];
    const alreadyDone = repo.hasCompletion(learnerId, experience.lessonId);
    if (!alreadyDone && isExperienceComplete(experience, viewedSlides(events), latestResults(events))) {
      lessonCompleted = true;
      repo.saveCompletion({
        learnerId,
        lessonId: experience.lessonId,
        lessonContentVersion: experience.lessonContentVersion,
        courseId: experience.courseId,
        experienceId,
        completedAt: now,
      });
      repo.appendEvent({
        id: randomUUID(),
        learnerId,
        type: 'lessonCompleted',
        courseId: experience.courseId,
        lessonId: experience.lessonId,
        lessonContentVersion: experience.lessonContentVersion,
        experienceId,
        at: now,
      });
      repo.saveStreak(learnerId, recordActivity(repo.getStreak(learnerId), today));

      const completed = repo.completedLessonIds(learnerId);
      const trees = repo.getTrees(experience.courseId);
      const current = trees[trees.length - 1];
      if (current && isTreeComplete(current, completed)) {
        const course = repo.getCourse(learnerId, experience.courseId);
        if (course.status !== 'completed') {
          treeCompleted = true;
          repo.saveCourse({ ...course, status: 'completed', updatedAt: now });
          repo.appendEvent({ id: randomUUID(), learnerId, type: 'courseCompleted', courseId: course.id, skillTreeId: current.id, at: now });
        }
      }
    }
  });

  // The lessons this completion unlocked start generating now, so the next tap is instant.
  if (lessonCompleted) prefetchAvailable(learnerId, experience.courseId);

  return {
    scored,
    lessonCompleted,
    treeCompleted,
    streak: repo.getStreak(learnerId),
    view: experienceView(learnerId, experience),
  };
}
