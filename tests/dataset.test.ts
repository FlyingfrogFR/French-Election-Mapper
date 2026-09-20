/**
 * Invariants of the real, generated dataset. These protect the "no distortion" promise:
 * every position must trace back to a dated, sourced declaration.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Dataset } from '../src/lib/schema';

const path = resolve(__dirname, '..', 'src', 'generated', 'dataset.json');
const ds = JSON.parse(readFileSync(path, 'utf8')) as Dataset;

describe('generated dataset', () => {
  it('exists (run `npm run data:build`)', () => {
    expect(existsSync(path)).toBe(true);
  });

  it('has topics, questions and candidates', () => {
    expect(ds.topics.length).toBeGreaterThanOrEqual(10);
    expect(ds.questions.length).toBeGreaterThanOrEqual(100);
    expect(ds.candidates.length).toBeGreaterThanOrEqual(10);
  });

  it('every question belongs to a known topic and every topic has questions', () => {
    const topics = new Set(ds.topics.map((t) => t.id));
    for (const q of ds.questions) expect(topics.has(q.topic)).toBe(true);
    for (const t of ds.topics) expect(ds.questions.some((q) => q.topic === t.id)).toBe(true);
  });

  it('every position references a known question and an existing declaration with an https source', () => {
    const questions = new Set(ds.questions.map((q) => q.id));
    const declarations = new Map(ds.declarations.map((d) => [d.id, d]));
    for (const c of ds.candidates) {
      for (const [qid, p] of Object.entries(c.positions)) {
        expect(questions.has(qid)).toBe(true);
        const d = declarations.get(p.declarationId);
        expect(d, `${c.id}/${qid} -> ${p.declarationId}`).toBeDefined();
        expect(d?.candidateId).toBe(c.id);
        expect(p.sourceUrl).toMatch(/^https:\/\//);
        expect(p.date).toBe(d?.date);
      }
    }
  });

  it('every candidate cites at least one source for their status', () => {
    for (const c of ds.candidates) expect(c.sources.length, c.id).toBeGreaterThan(0);
  });

  it('candidates are sorted by last name', () => {
    const names = ds.candidates.map((c) => c.lastName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr'));
    expect(names).toEqual(sorted);
  });

  it('declarations are sorted newest first', () => {
    for (let i = 1; i < ds.declarations.length; i++) expect(ds.declarations[i - 1].date >= ds.declarations[i].date).toBe(true);
  });

  it('statistics are consistent', () => {
    const known = ds.candidates.reduce((n, c) => n + c.stats.known, 0);
    expect(ds.stats.positions).toBe(known);
    expect(ds.stats.verified + ds.stats.pending + ds.stats.disputed).toBe(known);
  });

  it('has a 12-hex-character version', () => {
    expect(ds.version).toMatch(/^[0-9a-f]{12}$/);
  });
});
