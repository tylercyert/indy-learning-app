import { and, eq, inArray } from 'drizzle-orm';
import { LearningSummaryV1Schema, type LearningSummaryV1 } from '../../../src/contracts';
import { db } from '../db/client';
import { historyEvents, lessonCompletions, lessons } from '../db/schema';

/**
 * Builds the compact LearningSummary that goes into generation context.
 * Never the raw event log: completed lessons (title + objective), objectives the learner
 * struggled with (wrong answers), and objectives answered right first time.
 */
export function buildLearningSummary(learnerId: string, opts: { subject?: string; limit?: number } = {}): LearningSummaryV1 {
  const limit = opts.limit ?? 25;

  const completions = db
    .select({
      lessonId: lessonCompletions.lessonId,
      completedAt: lessonCompletions.completedAt,
      title: lessons.doc,
      subject: lessons.subject,
    })
    .from(lessonCompletions)
    .innerJoin(lessons, eq(lessons.id, lessonCompletions.lessonId))
    .where(opts.subject ? and(eq(lessonCompletions.learnerId, learnerId), eq(lessons.subject, opts.subject)) : eq(lessonCompletions.learnerId, learnerId))
    .all()
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({
      lessonId: r.lessonId,
      title: r.title.title,
      objective: r.title.objective,
      subject: r.subject,
      completedAt: r.completedAt,
    }));

  // Answer evidence per lesson: count wrong attempts and first-try correct answers.
  const answerRows = db
    .select({ lessonId: historyEvents.lessonId, doc: historyEvents.doc })
    .from(historyEvents)
    .where(and(eq(historyEvents.learnerId, learnerId), eq(historyEvents.type, 'componentAnswered')))
    .all();

  const perLesson = new Map<string, { wrong: number; firstTryRight: number; attempts: Map<string, number> }>();
  for (const row of answerRows) {
    if (!row.lessonId || row.doc.type !== 'componentAnswered' || row.doc.result.type !== 'multipleChoice') continue;
    const entry = perLesson.get(row.lessonId) ?? { wrong: 0, firstTryRight: 0, attempts: new Map() };
    const r = row.doc.result;
    const seen = entry.attempts.get(r.componentId) ?? 0;
    if (r.correct && seen === 0) entry.firstTryRight++;
    if (!r.correct) entry.wrong++;
    entry.attempts.set(r.componentId, seen + 1);
    perLesson.set(row.lessonId, entry);
  }

  const lessonIds = [...perLesson.keys()];
  const objectives = new Map<string, string>();
  if (lessonIds.length) {
    for (const row of db.select({ id: lessons.id, objective: lessons.objective }).from(lessons).where(inArray(lessons.id, lessonIds)).all()) {
      objectives.set(row.id, row.objective);
    }
  }

  const struggles = [...perLesson.entries()]
    .filter(([, e]) => e.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 10)
    .map(([lessonId, e]) => ({ objective: objectives.get(lessonId) ?? 'unknown objective', wrongAnswers: e.wrong }))
    .filter((s) => s.objective !== 'unknown objective');

  const strengths = [...perLesson.entries()]
    .filter(([, e]) => e.wrong === 0 && e.firstTryRight > 0)
    .slice(0, 10)
    .map(([lessonId]) => objectives.get(lessonId))
    .filter((o): o is string => !!o);

  return LearningSummaryV1Schema.parse({ completedLessons: completions, struggles, strengths });
}

export function describeSummary(summary: LearningSummaryV1): string {
  if (!summary.completedLessons.length && !summary.struggles.length) return 'This learner has no prior history on the platform.';
  const lines: string[] = [];
  if (summary.completedLessons.length) {
    lines.push('Lessons already completed (do not re-teach; build on them):');
    for (const l of summary.completedLessons.slice(0, 15)) lines.push(`- [${l.subject}] ${l.title}: ${l.objective}`);
  }
  if (summary.struggles.length) {
    lines.push('Objectives the learner got wrong at least once (reinforce gently, with a fresh angle):');
    for (const s of summary.struggles) lines.push(`- ${s.objective} (${s.wrongAnswers} wrong answer${s.wrongAnswers === 1 ? '' : 's'})`);
  }
  if (summary.strengths.length) {
    lines.push('Objectives answered right first time (can move faster here):');
    for (const s of summary.strengths) lines.push(`- ${s}`);
  }
  return lines.join('\n');
}
