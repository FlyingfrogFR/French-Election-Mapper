/**
 * Turns raw data into the dataset consumed by the app. Pure function: same input, same output, same hash.
 */
import { createHash } from 'node:crypto';
import type { CandidateRecord, Dataset, DeclarationRecord, DerivedPosition } from '../../src/lib/schema.ts';
import type { RawData } from './load.ts';

/** Deterministic JSON (sorted keys) so the hash does not depend on file formatting. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

export function datasetHash(raw: RawData): string {
  return createHash('sha256').update(canonicalJson(raw)).digest('hex').slice(0, 12);
}

export function deriveDataset(raw: RawData, generatedAt: string): Dataset {
  const declarations: DeclarationRecord[] = raw.declarationFiles
    .flatMap((f) => f.declarations.map((d) => ({ ...d, candidateId: f.candidateId })))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

  const byCandidate = new Map<string, DeclarationRecord[]>();
  for (const d of declarations) {
    const list = byCandidate.get(d.candidateId) ?? [];
    list.push(d);
    byCandidate.set(d.candidateId, list);
  }

  let totals = { positions: 0, verified: 0, pending: 0, disputed: 0 };
  let lastDeclarationDate: string | null = null;

  const candidates: CandidateRecord[] = raw.candidatesFile.candidates
    .map((c) => {
      const decls = byCandidate.get(c.id) ?? [];
      const positions: Record<string, DerivedPosition> = {};
      // Declarations are sorted newest first: the first one that mentions a question wins.
      for (const d of decls) {
        for (const p of d.positions) {
          if (positions[p.questionId]) continue;
          positions[p.questionId] = {
            value: p.value,
            declarationId: d.id,
            date: d.date,
            review: d.review.status,
            sourceUrl: d.sourceUrl,
            sourceTitle: d.title,
            sourceType: d.sourceType,
            ...(p.note ? { note: p.note } : {}),
          };
        }
      }
      const stats = { known: 0, verified: 0, pending: 0, disputed: 0, declarations: decls.length };
      for (const p of Object.values(positions)) {
        stats.known++;
        stats[p.review]++;
      }
      totals = {
        positions: totals.positions + stats.known,
        verified: totals.verified + stats.verified,
        pending: totals.pending + stats.pending,
        disputed: totals.disputed + stats.disputed,
      };
      const lastUpdated = decls.length ? decls[0].date : null;
      if (lastUpdated && (!lastDeclarationDate || lastUpdated > lastDeclarationDate)) lastDeclarationDate = lastUpdated;
      return { ...c, positions, lastUpdated, stats };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));

  return {
    version: datasetHash(raw),
    generatedAt,
    election: raw.candidatesFile.election,
    primaries: raw.candidatesFile.primaries,
    topics: [...raw.topics].sort((a, b) => a.order - b.order),
    questions: raw.questions,
    candidates,
    declarations,
    stats: {
      questions: raw.questions.length,
      candidates: candidates.length,
      ...totals,
      lastDeclarationDate,
    },
  };
}
