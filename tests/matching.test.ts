import { describe, expect, it } from 'vitest';
import { agreement, computeConfidence, computeResults, DEFAULT_OPTIONS, type Responses } from '../src/lib/matching';
import type { CandidateRecord, Dataset, DerivedPosition, PositionValue } from '../src/lib/schema';

function pos(value: PositionValue, review: DerivedPosition['review'] = 'pending'): DerivedPosition {
  return { value, declarationId: 'd', date: '2026-01-01', review, sourceUrl: 'https://example.org', sourceTitle: 't', sourceType: 'programme' };
}

function candidate(id: string, positions: Record<string, DerivedPosition>, status: CandidateRecord['status'] = 'declared'): CandidateRecord {
  return {
    id,
    firstName: id,
    lastName: id.toUpperCase(),
    displayName: id,
    party: 'P',
    partyShort: 'P',
    status,
    declaredOn: null,
    statusNote: null,
    primary: null,
    website: null,
    sources: [{ title: 'src', url: 'https://example.org', date: '2026-01-01' }],
    positions,
    lastUpdated: '2026-01-01',
    stats: { known: Object.keys(positions).length, verified: 0, pending: Object.keys(positions).length, disputed: 0, declarations: 1 },
  };
}

const questions = Array.from({ length: 12 }, (_, i) => ({ id: `t${i % 2 === 0 ? 'a' : 'b'}-${String(i).padStart(2, '0')}`, topic: i % 2 === 0 ? 'a' : 'b', statement: `Q${i} ?` }));

function ds(candidates: CandidateRecord[]): Dataset {
  return {
    version: 'test',
    generatedAt: '2026-01-01T00:00:00Z',
    election: { name: 'e', firstRound: '2027-04-18', secondRound: '2027-05-02', sponsorshipDeadline: '2027-03-12', notes: '' },
    primaries: {},
    topics: [
      { id: 'a', order: 1, title: 'A', short: 'A', description: '' },
      { id: 'b', order: 2, title: 'B', short: 'B', description: '' },
    ],
    questions,
    candidates,
    declarations: [],
    stats: { questions: questions.length, candidates: candidates.length, positions: 0, verified: 0, pending: 0, disputed: 0, lastDeclarationDate: null },
  };
}

const allPositions = (v: PositionValue) => Object.fromEntries(questions.map((q) => [q.id, pos(v)]));
const answerAll = (v: PositionValue, important = false): Responses => Object.fromEntries(questions.map((q) => [q.id, { value: v, important }]));

describe('agreement', () => {
  it('is 1 for identical positions and 0 for opposite extremes', () => {
    expect(agreement(2, 2)).toBe(1);
    expect(agreement(-2, 2)).toBe(0);
    expect(agreement(0, 2)).toBe(0.5);
    expect(agreement(1, -1)).toBe(0.5);
  });
  it('is symmetric', () => {
    expect(agreement(1, -2)).toBe(agreement(-2, 1));
  });
});

describe('computeResults', () => {
  it('ranks the candidate with identical positions first with a 100 % score', () => {
    const d = ds([candidate('same', allPositions(2)), candidate('opposite', allPositions(-2)), candidate('neutral', allPositions(0))]);
    const r = computeResults(d, answerAll(2));
    expect(r.ranking.map((x) => x.candidate.id)).toEqual(['same', 'neutral', 'opposite']);
    expect(r.top?.score).toBe(1);
    expect(r.ranking[1].score).toBe(0.5);
    expect(r.ranking[2].score).toBe(0);
  });

  it('produces no ranking below the minimum number of answers', () => {
    const d = ds([candidate('a', allPositions(2))]);
    const r = computeResults(d, { [questions[0].id]: { value: 2, important: false } });
    expect(r.answered).toBe(1);
    expect(r.ranking).toHaveLength(0);
    expect(r.top).toBeNull();
    expect(r.confidence).toBeNull();
  });

  it('ignores skipped questions', () => {
    const d = ds([candidate('a', allPositions(2))]);
    const responses = answerAll(2);
    responses[questions[0].id] = { skipped: true };
    const r = computeResults(d, responses);
    expect(r.answered).toBe(11);
    expect(r.skipped).toBe(1);
    expect(r.top?.used).toBe(11);
  });

  it('excludes candidates with insufficient coverage but keeps them listed', () => {
    const few = { [questions[0].id]: pos(2), [questions[1].id]: pos(2) };
    const d = ds([candidate('full', allPositions(1)), candidate('sparse', few)]);
    const r = computeResults(d, answerAll(2));
    expect(r.ranking.map((x) => x.candidate.id)).toEqual(['full']);
    const sparse = r.excluded.find((x) => x.candidate.id === 'sparse');
    expect(sparse?.exclusionReason).toBe('coverage');
    expect(sparse?.coverage).toBeCloseTo(2 / 12);
    // Its score is still computed on what is known, for display.
    expect(sparse?.score).toBe(1);
  });

  it('excludes "potential" candidates by status, whatever their score', () => {
    const d = ds([candidate('maybe', allPositions(2), 'potential'), candidate('sure', allPositions(1))]);
    const r = computeResults(d, answerAll(2));
    expect(r.ranking.map((x) => x.candidate.id)).toEqual(['sure']);
    expect(r.excluded[0].exclusionReason).toBe('status');
  });

  it('gives double weight to questions flagged as important', () => {
    // Candidate agrees on q0 only; user flags q0 important. 6 answered: q0 weight 2 agreement 1, five others weight 1 agreement 0 → 2/7.
    const six = questions.slice(0, 6);
    const positions = Object.fromEntries(six.map((q, i) => [q.id, pos(i === 0 ? 2 : -2)]));
    const d = ds([candidate('c', positions)]);
    const responses: Responses = Object.fromEntries(six.map((q, i) => [q.id, { value: 2, important: i === 0 }]));
    const r = computeResults(d, responses, { minAnswered: 6 });
    expect(r.top?.score).toBeCloseTo(2 / 7);
  });

  it('breaks ties alphabetically by last name, independent of input order', () => {
    const d = ds([candidate('zed', allPositions(2)), candidate('alpha', allPositions(2))]);
    const r = computeResults(d, answerAll(2));
    expect(r.ranking.map((x) => x.candidate.id)).toEqual(['alpha', 'zed']);
  });

  it('computes per-topic scores', () => {
    const positions = Object.fromEntries(questions.map((q) => [q.id, pos(q.topic === 'a' ? 2 : -2)]));
    const d = ds([candidate('c', positions)]);
    const r = computeResults(d, answerAll(2));
    const a = r.top?.byTopic.find((t) => t.topicId === 'a');
    const b = r.top?.byTopic.find((t) => t.topicId === 'b');
    expect(a?.score).toBe(1);
    expect(b?.score).toBe(0);
    expect(a?.answered).toBe(6);
  });

  it('is deterministic', () => {
    const d = ds([candidate('a', allPositions(1)), candidate('b', allPositions(-1))]);
    const r1 = JSON.stringify(computeResults(d, answerAll(2)));
    const r2 = JSON.stringify(computeResults(d, answerAll(2)));
    expect(r1).toBe(r2);
  });
});

describe('computeConfidence', () => {
  const base = (score: number, coverage = 1, verifiedShare = 0) =>
    ({ score, coverage, verifiedShare } as unknown as Parameters<typeof computeConfidence>[0]);

  it('is 100 when many answers, full coverage, all verified and a clear margin', () => {
    const c = computeConfidence(base(0.9, 1, 1), base(0.5), 100, DEFAULT_OPTIONS);
    expect(c.score).toBe(100);
  });

  it('drops when the top two candidates are tied', () => {
    const tied = computeConfidence(base(0.8), base(0.8), 100, DEFAULT_OPTIONS);
    const clear = computeConfidence(base(0.8), base(0.6), 100, DEFAULT_OPTIONS);
    expect(tied.components.margin).toBe(0);
    expect(tied.score).toBeLessThan(clear.score);
  });

  it('drops with few answers', () => {
    const few = computeConfidence(base(0.8), base(0.5), 10, DEFAULT_OPTIONS);
    const many = computeConfidence(base(0.8), base(0.5), 40, DEFAULT_OPTIONS);
    expect(few.components.answers).toBeCloseTo(0.25);
    expect(few.score).toBeLessThan(many.score);
  });

  it('never rewards unverified positions more than verified ones', () => {
    const unverified = computeConfidence(base(0.8, 1, 0), base(0.5), 40, DEFAULT_OPTIONS);
    const verified = computeConfidence(base(0.8, 1, 1), base(0.5), 40, DEFAULT_OPTIONS);
    expect(unverified.score).toBeLessThan(verified.score);
  });
});
