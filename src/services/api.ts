import AsyncStorage from '@react-native-async-storage/async-storage';
import { LearnerV1Schema, type LearnerV1 } from '../contracts';

/**
 * The client's only door to the server. The server holds the model key and all data.
 * EXPO_PUBLIC_API_URL is public by design; nothing secret lives in the app bundle.
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
  if (auth) {
    const token = await ensureToken();
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
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

export const api = {
  baseUrl,
  health: () => request<Health>('/health', {}, false),
  me: () => request<{ learner: LearnerV1 }>('/me'),
};
