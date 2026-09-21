/**
 * Everything the user produces (answers, settings, feedback) stays on their device.
 * Two modes: `local` (localStorage, survives a browser restart so a long questionnaire can be resumed)
 * and `session` (sessionStorage, wiped when the tab closes). Every access is wrapped in try/catch
 * because storage can be unavailable (private browsing, blocked site data, embedded previews).
 */
import type { Responses } from './matching';

export const STORAGE_VERSION = 1;
export type StorageMode = 'local' | 'session';

export interface Feedback {
  suggestedCandidateId: string;
  agreement: 'yes' | 'partly' | 'no';
  expectedCandidateId: string | null;
  createdAt: string;
  datasetVersion: string;
  sentAnonymously: boolean;
}

export interface PersistedState {
  version: number;
  responses: Responses;
  updatedAt: string;
  feedback: Feedback | null;
}

const KEY_STATE = `boussole2027:v${STORAGE_VERSION}:state`;
const KEY_MODE = `boussole2027:v${STORAGE_VERSION}:mode`;
const KEY_CONSENT = `boussole2027:v${STORAGE_VERSION}:notice-acknowledged`;
/** Owned by src/lib/theme.ts; listed here so "erase everything" really erases everything. */
const KEY_THEME = `boussole2027:v${STORAGE_VERSION}:theme`;

function backend(mode: StorageMode): Storage | null {
  try {
    const s = mode === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    // Some browsers expose the object but throw on access.
    s.getItem('__probe__');
    return s;
  } catch {
    return null;
  }
}

export function getMode(): StorageMode {
  try {
    return globalThis.localStorage?.getItem(KEY_MODE) === 'session' ? 'session' : 'local';
  } catch {
    return 'session';
  }
}

export function setMode(mode: StorageMode): void {
  const current = loadState();
  clearAll();
  try {
    globalThis.localStorage?.setItem(KEY_MODE, mode);
  } catch {
    /* ignore */
  }
  if (current) saveState(current, mode);
}

export function loadState(mode: StorageMode = getMode()): PersistedState | null {
  const s = backend(mode);
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_STATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== STORAGE_VERSION || typeof parsed.responses !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState, mode: StorageMode = getMode()): boolean {
  const s = backend(mode);
  if (!s) return false;
  try {
    s.setItem(KEY_STATE, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Right to erasure, in one call: removes every key this app ever wrote, in both backends. */
export function clearAll(): void {
  for (const mode of ['local', 'session'] as const) {
    const s = backend(mode);
    if (!s) continue;
    try {
      for (const key of [KEY_STATE, KEY_MODE, KEY_CONSENT, KEY_THEME]) s.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function noticeAcknowledged(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY_CONSENT) === '1';
  } catch {
    return false;
  }
}

export function acknowledgeNotice(): void {
  try {
    globalThis.localStorage?.setItem(KEY_CONSENT, '1');
  } catch {
    /* ignore */
  }
}

/** Right to portability: everything stored, as a downloadable JSON document. */
export function exportState(state: PersistedState | null): string {
  return JSON.stringify(
    {
      application: 'Boussole présidentielle 2027',
      exportedAt: new Date().toISOString(),
      storageVersion: STORAGE_VERSION,
      state,
    },
    null,
    2,
  );
}
