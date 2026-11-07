import AsyncStorage from '@react-native-async-storage/async-storage';
import type { z } from 'zod';
import {
  CourseListSchema,
  CourseViewSchema,
  ExperienceEventResponseSchema,
  ExperienceViewSchema,
  IntakeSessionViewSchema,
  LearnerV1Schema,
  type ExperienceEventRequest,
  type LearnerV1,
} from '../contracts';

/**
 * The client's only door to the server. The server holds the model key and all data.
 * EXPO_PUBLIC_API_URL is public by design; nothing secret lives in the app bundle.
 * Every response is validated against the shared contract before a screen sees it.
 */
const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const TOKEN_KEY = 'indy.learnerToken';

export interface Health {
  ok: boolean;
  ai: boolean;
  time: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly kind?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this launch only.
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (auth) headers.Authorization = `Bearer ${await ensureToken()}`;
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    let kind: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; kind?: string };
      if (body.error) message = body.error;
      kind = body.kind;
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message, kind);
  }
  return (await res.json()) as T;
}

async function validated<S extends z.ZodType>(schema: S, promise: Promise<unknown>): Promise<z.infer<S>> {
  const data = await promise;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(500, `Response did not match contract: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

let tokenPromise: Promise<string> | null = null;

/** Returns the anonymous learner token, creating a learner on first launch. */
export function ensureToken(): Promise<string> {
  tokenPromise ??= (async () => {
    const existing = await readToken();
    if (existing) return existing;
    const created = await request<{ learner: LearnerV1; token: string }>('/learners', { method: 'POST' }, false);
    LearnerV1Schema.parse(created.learner);
    await writeToken(created.token);
    return created.token;
  })();
  return tokenPromise;
}

const post = (path: string, body: unknown) => request<unknown>(path, { method: 'POST', body: JSON.stringify(body) });
const get = (path: string) => request<unknown>(path);

export const api = {
  baseUrl,
  health: () => request<Health>('/health', {}, false),
  me: () => request<{ learner: LearnerV1 }>('/me'),

  startIntake: (goal: string, courseId?: string) => validated(IntakeSessionViewSchema, post('/intakes', { goal, courseId })),
  replyIntake: (id: string, answer: string) => validated(IntakeSessionViewSchema, post(`/intakes/${id}/reply`, { answer })),
  getIntake: (id: string) => validated(IntakeSessionViewSchema, get(`/intakes/${id}`)),

  createCourse: (intakeId: string) => validated(CourseViewSchema, post('/courses', { intakeId })),
  listCourses: () => validated(CourseListSchema, get('/courses')),
  getCourse: (id: string) => validated(CourseViewSchema, get(`/courses/${id}`)),

  openNode: (courseId: string, nodeId: string) => validated(ExperienceViewSchema, post(`/courses/${courseId}/nodes/${nodeId}/experience`, {})),
  getExperience: (id: string) => validated(ExperienceViewSchema, get(`/experiences/${id}`)),
  sendEvent: (experienceId: string, event: ExperienceEventRequest) =>
    validated(ExperienceEventResponseSchema, post(`/experiences/${experienceId}/events`, event)),
};

/** The learner's local calendar day, for streaks. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
