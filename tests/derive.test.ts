import { describe, expect, it } from 'vitest';
import { canonicalJson, datasetHash, deriveDataset } from '../scripts/lib/derive';
import type { RawData } from '../scripts/lib/load';

const raw = (): RawData => ({
  topics: [{ id: 'eco', order: 1, title: 'Économie', short: 'Éco', description: 'd' }],
  questions: [
    { id: 'eco-01', topic: 'eco', statement: 'Statement one ?' },
    { id: 'eco-02', topic: 'eco', statement: 'Statement two ?' },
  ],
  candidatesFile: {
    election: { name: 'e', firstRound: '2027-04-18', secondRound: '2027-05-02', sponsorshipDeadline: '2027-03-12', notes: '' },
    primaries: {},
    candidates: [
      {
        id: 'x',
        firstName: 'X',
        lastName: 'Xx',
        displayName: 'X Xx',
        party: 'P',
        partyShort: 'P',
        status: 'declared',
        declaredOn: null,
        statusNote: null,
        primary: null,
        website: null,
        sources: [{ title: 'src', url: 'https://example.org', date: '2026-01-01' }],
      },
    ],
  },
  declarationFiles: [
    {
      candidateId: 'x',
      declarations: [
        {
          id: 'x-old',
          date: '2022-01-01',
          title: 'Old programme',
          sourceType: 'programme',
          sourceUrl: 'https://example.org/old',
          publisher: 'p',
          summary: 'old summary',
          review: { status: 'verified', reviewers: ['a', 'b'], reviewedOn: '2026-01-01' },
          positions: [
            { questionId: 'eco-01', value: -2 },
            { questionId: 'eco-02', value: 1 },
          ],
        },
        {
          id: 'x-new',
          date: '2026-06-01',
          title: 'New interview',
          sourceType: 'interview',
          sourceUrl: 'https://example.org/new',
          publisher: 'p',
          summary: 'new summary',
          review: { status: 'pending', reviewers: [], reviewedOn: null },
          positions: [{ questionId: 'eco-01', value: 2 }],
        },
      ],
    },
  ],
});

describe('deriveDataset', () => {
  it('lets the most recent declaration win for each question and keeps provenance', () => {
    const ds = deriveDataset(raw(), '2026-09-20T00:00:00Z');
    const x = ds.candidates[0];
    expect(x.positions['eco-01']).toMatchObject({ value: 2, declarationId: 'x-new', review: 'pending', sourceUrl: 'https://example.org/new' });
    expect(x.positions['eco-02']).toMatchObject({ value: 1, declarationId: 'x-old', review: 'verified' });
    expect(x.lastUpdated).toBe('2026-06-01');
    expect(x.stats).toEqual({ known: 2, verified: 1, pending: 1, disputed: 0, declarations: 2 });
    expect(ds.stats.lastDeclarationDate).toBe('2026-06-01');
    expect(ds.declarations[0].id).toBe('x-new');
  });

  it('does not depend on declaration order in the file', () => {
    const a = raw();
    const b = raw();
    b.declarationFiles[0].declarations.reverse();
    const da = deriveDataset(a, '2026-09-20T00:00:00Z');
    const db = deriveDataset(b, '2026-09-20T00:00:00Z');
    expect(da.candidates[0].positions).toEqual(db.candidates[0].positions);
  });

  it('hashes the canonical JSON, independent of key order', () => {
    const a = raw();
    const b = raw();
    // Re-create the same nested object with its keys in reverse order.
    const reversed = Object.fromEntries(Object.entries(b.candidatesFile.election).reverse()) as typeof b.candidatesFile.election;
    b.candidatesFile = { ...b.candidatesFile, election: reversed };
    expect(Object.keys(b.candidatesFile.election)).not.toEqual(Object.keys(a.candidatesFile.election));
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(datasetHash(a)).toBe(datasetHash(b));
    expect(datasetHash(a)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('changes the hash when a position changes', () => {
    const a = raw();
    const b = raw();
    b.declarationFiles[0].declarations[1].positions[0].value = -1;
    expect(datasetHash(a)).not.toBe(datasetHash(b));
  });
});
