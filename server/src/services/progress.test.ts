import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CourseV1, LearningExperienceV1, LessonV1, SkillTreeV1 } from '../../../src/contracts';
import { BASE_COMPANION } from '../../../src/contracts';
import { examplePlan, exampleSlides } from '../../../src/contracts/examples';

process.env.ALLOW_NO_AI = '1';
process.env.DATABASE_PATH = ':memory:';
delete process.env.ANTHROPIC_API_KEY;

type Progress = typeof import('./progress');
type Repo = typeof import('./repo');
type Db = typeof import('../db/client');
type Schema = typeof import('../db/schema');

let progress: Progress;
let repo: Repo;
let dbm: Db;
let schema: Schema;

const learnerId = randomUUID();
const courseId = randomUUID();
const now = '2026-11-07T18:00:00.000Z';

function seed() {
  dbm.runMigrations();
  dbm.db.insert(schema.learners).values({ id: learnerId, token: 't-' + learnerId, displayName: null, createdAt: now }).run();

  const lessonIds = new Map(examplePlan.nodes.map((n) => [n.id, randomUUID()] as const));
  for (const n of examplePlan.nodes) {
    const lesson: LessonV1 = {
      schemaVersion: 1,
      id: lessonIds.get(n.id)!,
      title: n.title,
      objective: n.objective,
      subject: 'mixology',
      tags: [],
      difficulty: 'core',
      estimatedMinutes: 5,
      contentVersion: 1,
      createdAt: now,
    };
    repo.saveLesson(lesson);
  }
  const course: CourseV1 = {
    schemaVersion: 1,
    id: courseId,
    learnerId,
    title: examplePlan.title,
    subject: 'mixology',
    summary: examplePlan.summary,
    context: {
      schemaVersion: 1,
      goal: { topic: 'mixology', statement: 'party', outcome: 'balanced drinks', application: null },
      experience: { level: 'new', notes: null },
      horizon: 'quickWin',
      facts: [],
      constraints: [],
    },
    companion: BASE_COMPANION,
    status: 'active',
    discoverable: true,
    sourceCourseId: null,
    createdAt: now,
    updatedAt: now,
  };
  repo.saveCourse(course);
  const tree: SkillTreeV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    courseId,
    title: 'Balance basics',
    sequence: 0,
    createdAt: now,
    nodes: examplePlan.nodes.map((n) => ({
      id: n.id,
      lessonId: lessonIds.get(n.id)!,
      title: n.title,
      objective: n.objective,
      kind: n.kind,
      required: n.required,
      rule: n.rule,
    })),
  };
  repo.saveTree(tree);
  return { lessonIds, tree };
}

function experienceFor(lessonId: string): LearningExperienceV1 {
  const exp: LearningExperienceV1 = {
    schemaVersion: 1,
    id: randomUUID(),
    lessonId,
    lessonContentVersion: 1,
    learnerId,
    courseId,
    slides: exampleSlides.slides,
    generatedBy: 'test',
    generatedAt: now,
  };
  repo.saveExperience(exp);
  return exp;
}

let seeded: ReturnType<typeof seed>;

beforeAll(async () => {
  dbm = await import('../db/client');
  schema = await import('../db/schema');
  repo = await import('./repo');
  progress = await import('./progress');
  seeded = seed();
});

describe('progress service (in-memory SQLite, no model)', () => {
  it('starts with only the orientation node available', () => {
    const view = progress.courseView(learnerId, courseId);
    expect(view.trees[0]!.nodeStates.orientation).toBe('available');
    expect(view.trees[0]!.nodeStates.acidity).toBe('locked');
    expect(view.trees[0]!.nextNodeId).toBe('orientation');
    expect(view.streak).toEqual({ count: 0, lastActiveDate: null });
  });

  it('scores an answer deterministically, teaches on the wrong option, and does not complete early', () => {
    const exp = experienceFor(seeded.lessonIds.get('orientation')!);
    const wrong = progress.recordEvent(learnerId, exp.id, { type: 'answer', slideId: 'check', componentId: 'q1', selectedOptionId: 'd' });
    expect(wrong.scored).toMatchObject({ correct: false, correctOptionId: 'b', attempt: 1 });
    expect(wrong.scored!.explanation).toMatch(/Dilution/);
    expect(wrong.lessonCompleted).toBe(false);
    const right = progress.recordEvent(learnerId, exp.id, { type: 'answer', slideId: 'check', componentId: 'q1', selectedOptionId: 'b' });
    expect(right.scored).toMatchObject({ correct: true, attempt: 2 });
    expect(right.view.results).toHaveLength(1);
    expect(right.lessonCompleted).toBe(false);
  });

  it('completes the lesson once every slide is viewed, updates the streak once, and unlocks siblings', () => {
    const exp = repo.findExperience(learnerId, courseId, seeded.lessonIds.get('orientation')!)!;
    let last: ReturnType<Progress['recordEvent']> | undefined;
    for (const slide of exp.slides) {
      last = progress.recordEvent(learnerId, exp.id, { type: 'slideViewed', slideId: slide.id, localDate: '2026-11-07' });
    }
    expect(last!.lessonCompleted).toBe(true);
    expect(last!.treeCompleted).toBe(false);
    expect(last!.streak).toEqual({ count: 1, lastActiveDate: '2026-11-07' });
    expect(last!.view.completed).toBe(true);

    const again = progress.recordEvent(learnerId, exp.id, { type: 'slideViewed', slideId: exp.slides[0]!.id, localDate: '2026-11-07' });
    expect(again.lessonCompleted).toBe(false);
    expect(again.streak.count).toBe(1);

    const view = progress.courseView(learnerId, courseId);
    expect(view.trees[0]!.nodeStates).toMatchObject({ orientation: 'completed', acidity: 'available', dilution: 'available', 'non-alc': 'locked', design: 'locked' });
  });

  it('completes the course when required nodes are done, leaving the optional branch open', () => {
    for (const nodeId of ['acidity', 'dilution', 'design']) {
      const exp = experienceFor(seeded.lessonIds.get(nodeId)!);
      progress.recordEvent(learnerId, exp.id, { type: 'answer', slideId: 'check', componentId: 'q1', selectedOptionId: 'b' });
      let last: ReturnType<Progress['recordEvent']> | undefined;
      for (const slide of exp.slides) last = progress.recordEvent(learnerId, exp.id, { type: 'slideViewed', slideId: slide.id, localDate: '2026-11-08' });
      expect(last!.treeCompleted).toBe(nodeId === 'design');
    }
    const view = progress.courseView(learnerId, courseId);
    expect(view.course.status).toBe('completed');
    expect(view.trees[0]!.complete).toBe(true);
    expect(view.trees[0]!.nodeStates['non-alc']).toBe('available');
    expect(view.streak).toEqual({ count: 2, lastActiveDate: '2026-11-08' });
    const list = progress.courseList(learnerId);
    expect(list.courses[0]!.progress).toEqual({ completed: 4, required: 4, total: 5 });
  });

  it('rejects an answer for an option that is not on the component', () => {
    const exp = repo.findExperience(learnerId, courseId, seeded.lessonIds.get('acidity')!)!;
    expect(() => progress.recordEvent(learnerId, exp.id, { type: 'answer', slideId: 'check', componentId: 'q1', selectedOptionId: 'zz' })).toThrow();
  });
});
