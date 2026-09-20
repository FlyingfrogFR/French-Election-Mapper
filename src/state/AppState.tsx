import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dataset } from '../lib/dataset';
import { computeResults, type Response, type Responses, type Results } from '../lib/matching';
import {
  acknowledgeNotice,
  clearAll,
  getMode,
  loadState,
  noticeAcknowledged,
  saveState,
  setMode as persistMode,
  STORAGE_VERSION,
  type Feedback,
  type StorageMode,
} from '../lib/storage';

interface AppState {
  responses: Responses;
  feedback: Feedback | null;
  mode: StorageMode;
  persisted: boolean;
  noticeSeen: boolean;
  results: Results;
  setResponse: (questionId: string, response: Response) => void;
  clearResponse: (questionId: string) => void;
  setFeedback: (feedback: Feedback | null) => void;
  setMode: (mode: StorageMode) => void;
  markNoticeSeen: () => void;
  reset: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadState(), []);
  const [responses, setResponses] = useState<Responses>(initial?.responses ?? {});
  const [feedback, setFeedbackState] = useState<Feedback | null>(initial?.feedback ?? null);
  const [mode, setModeState] = useState<StorageMode>(getMode());
  const [persisted, setPersisted] = useState<boolean>(!!initial);
  const [noticeSeen, setNoticeSeen] = useState<boolean>(noticeAcknowledged());
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ok = saveState({ version: STORAGE_VERSION, responses, feedback, updatedAt: new Date().toISOString() }, mode);
    setPersisted(ok);
  }, [responses, feedback, mode]);

  const setResponse = useCallback((questionId: string, response: Response) => {
    setResponses((prev) => ({ ...prev, [questionId]: response }));
  }, []);
  const clearResponse = useCallback((questionId: string) => {
    setResponses((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);
  const setFeedback = useCallback((f: Feedback | null) => setFeedbackState(f), []);
  const setMode = useCallback((m: StorageMode) => {
    persistMode(m);
    setModeState(m);
  }, []);
  const markNoticeSeen = useCallback(() => {
    acknowledgeNotice();
    setNoticeSeen(true);
  }, []);
  const reset = useCallback(() => {
    clearAll();
    setResponses({});
    setFeedbackState(null);
    setNoticeSeen(false);
    setPersisted(false);
    first.current = true;
  }, []);

  const results = useMemo(() => computeResults(dataset, responses), [responses]);

  const value = useMemo<AppState>(
    () => ({ responses, feedback, mode, persisted, noticeSeen, results, setResponse, clearResponse, setFeedback, setMode, markNoticeSeen, reset }),
    [responses, feedback, mode, persisted, noticeSeen, results, setResponse, clearResponse, setFeedback, setMode, markNoticeSeen, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
