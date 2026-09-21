/**
 * Verbatim quotes are served separately from the dataset (they are a third of its weight and are
 * only needed once the reader looks at a position's provenance). This hook fetches them once,
 * from this origin, and degrades gracefully: without them the source link and date are still shown.
 */
import { useEffect, useState } from 'react';
import type { QuoteMap } from './schema';

let cache: QuoteMap | null = null;
let inFlight: Promise<QuoteMap> | null = null;

export function loadQuotes(): Promise<QuoteMap> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = fetch(`${import.meta.env.BASE_URL}data/quotes.json`, { credentials: 'omit' })
      .then((r) => (r.ok ? (r.json() as Promise<QuoteMap>) : {}))
      .catch(() => ({}))
      .then((m) => {
        cache = m;
        return m;
      });
  }
  return inFlight;
}

export function useQuotes(): QuoteMap {
  const [map, setMap] = useState<QuoteMap>(cache ?? {});
  useEffect(() => {
    let alive = true;
    loadQuotes().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

export const quoteKey = (candidateId: string, questionId: string): string => `${candidateId}|${questionId}`;
