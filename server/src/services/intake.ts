import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { IntakeTurnV1Schema, type IntakeSessionView, type IntakeTurnV1, type LearnerContextV1 } from '../../../src/contracts';
import { generateStructured } from '../ai/claude';
import { INTAKE_SYSTEM, intakeUserMessage } from '../ai/prompts';
import { db } from '../db/client';
import { intakeSessions, type IntakeMessage } from '../db/schema';
import { NotFoundError } from './repo';

/** Hard cap on companion questions; the model is told when it must return "ready". */
export const MAX_INTAKE_QUESTIONS = 4;

type Row = typeof intakeSessions.$inferSelect;

function questionsAsked(transcript: IntakeMessage[]): number {
  return transcript.filter((m) => m.role === 'companion').length;
}

/**
 * Rebuilds the current turn from stored state, so a reload (or a second device) sees the same
 * question and quick answers as the response that produced them.
 */
export function reconstructTurn(
  status: string,
  transcript: IntakeMessage[],
  context: LearnerContextV1 | null,
): IntakeTurnV1 | null {
  const lastCompanion = [...transcript].reverse().find((m) => m.role === 'companion');
  if (!lastCompanion) return null;
  if (status === 'open') {
    return { kind: 'ask', question: lastCompanion.text, suggestedAnswers: lastCompanion.suggestedAnswers ?? [] };
  }
  if ((status === 'ready' || status === 'planned') && context) {
    return { kind: 'ready', context, summary: lastCompanion.text };
  }
  return null;
}

function toView(row: Row, turn: IntakeTurnV1 | null): IntakeSessionView {
  return {
    id: row.id,
    status: row.status as IntakeSessionView['status'],
    courseId: row.courseId ?? null,
    transcript: row.transcript,
    turn: turn ?? reconstructTurn(row.status, row.transcript, row.context ?? null),
    questionsAsked: questionsAsked(row.transcript),
    context: row.context ?? null,
  };
}

function loadRow(learnerId: string, id: string): Row {
  const row = db.select().from(intakeSessions).where(and(eq(intakeSessions.id, id), eq(intakeSessions.learnerId, learnerId))).get();
  if (!row) throw new NotFoundError('intake session');
  return row;
}

async function nextTurn(transcript: IntakeMessage[]): Promise<IntakeTurnV1> {
  const asked = questionsAsked(transcript);
  const { data } = await generateStructured({
    task: 'intake',
    fast: false,
    schema: IntakeTurnV1Schema,
    system: INTAKE_SYSTEM,
    messages: [{ role: 'user', content: intakeUserMessage(transcript, asked, MAX_INTAKE_QUESTIONS) }],
    effort: 'medium',
    maxTokens: 4000,
  });
  // Belt and braces: the cap is enforced in code, not only in the prompt.
  if (data.kind === 'ask' && asked >= MAX_INTAKE_QUESTIONS) {
    throw new Error('intake exceeded the question cap');
  }
  return data;
}

function applyTurn(row: Row, turn: IntakeTurnV1, now: string): { transcript: IntakeMessage[]; status: string; context: LearnerContextV1 | null } {
  if (turn.kind === 'ask') {
    return {
      transcript: [...row.transcript, { role: 'companion', text: turn.question, at: now, suggestedAnswers: turn.suggestedAnswers }],
      status: 'open',
      context: null,
    };
  }
  return { transcript: [...row.transcript, { role: 'companion', text: turn.summary, at: now }], status: 'ready', context: turn.context };
}

export async function startIntake(learnerId: string, goal: string, courseId?: string): Promise<IntakeSessionView> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const transcript: IntakeMessage[] = [{ role: 'learner', text: goal, at: now }];
  db.insert(intakeSessions)
    .values({ id, learnerId, courseId: courseId ?? null, status: 'open', transcript, context: null, createdAt: now, updatedAt: now })
    .run();
  const row = loadRow(learnerId, id);
  const turn = await nextTurn(transcript);
  const next = applyTurn(row, turn, new Date().toISOString());
  db.update(intakeSessions)
    .set({ transcript: next.transcript, status: next.status, context: next.context, updatedAt: new Date().toISOString() })
    .where(eq(intakeSessions.id, id))
    .run();
  return toView(loadRow(learnerId, id), turn);
}

export async function replyIntake(learnerId: string, id: string, answer: string): Promise<IntakeSessionView> {
  const row = loadRow(learnerId, id);
  if (row.status !== 'open') throw new Error(`intake is ${row.status}; no further answers accepted`);
  const now = new Date().toISOString();
  const transcript: IntakeMessage[] = [...row.transcript, { role: 'learner', text: answer, at: now }];
  const turn = await nextTurn(transcript);
  const next = applyTurn({ ...row, transcript }, turn, new Date().toISOString());
  db.update(intakeSessions)
    .set({ transcript: next.transcript, status: next.status, context: next.context, updatedAt: new Date().toISOString() })
    .where(eq(intakeSessions.id, id))
    .run();
  return toView(loadRow(learnerId, id), turn);
}

export function getIntake(learnerId: string, id: string): IntakeSessionView {
  const row = loadRow(learnerId, id);
  return toView(row, null);
}

export function readyContext(learnerId: string, id: string): { row: Row; context: LearnerContextV1 } {
  const row = loadRow(learnerId, id);
  if (row.status !== 'ready' || !row.context) throw new Error(`intake is ${row.status}; cannot plan a course yet`);
  return { row, context: row.context };
}

export function markPlanned(id: string): void {
  db.update(intakeSessions).set({ status: 'planned', updatedAt: new Date().toISOString() }).where(eq(intakeSessions.id, id)).run();
}
