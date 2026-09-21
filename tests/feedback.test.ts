import { describe, expect, it } from 'vitest';
import { answeredBucket, bucket10, buildAnonymousPayload } from '../src/lib/feedback';
import type { Results } from '../src/lib/matching';

describe('anonymous feedback payload', () => {
  it('buckets values into decades', () => {
    expect(bucket10(0)).toBe('0-9');
    expect(bucket10(74.9)).toBe('70-79');
    expect(bucket10(100)).toBe('90-99');
    expect(answeredBucket(5)).toBe('<20');
    expect(answeredBucket(163)).toBe('120+');
  });

  it('contains only coarse, non-identifying fields', () => {
    const results = { top: { score: 0.78 }, confidence: { score: 64 }, answered: 90 } as unknown as Results;
    const payload = buildAnonymousPayload(
      { suggestedCandidateId: 'x', agreement: 'partly', expectedCandidateId: 'y', createdAt: '2026-09-20T10:00:00Z', datasetVersion: 'abc', sentAnonymously: false },
      results,
    );
    expect(payload).toEqual({
      v: 1,
      datasetVersion: 'abc',
      suggested: 'x',
      agreement: 'partly',
      expected: 'y',
      matchBucket: '70-79',
      confidenceBucket: '60-69',
      answeredBucket: '80-119',
    });
    expect(Object.keys(payload)).not.toContain('createdAt');
    expect(JSON.stringify(payload)).not.toContain('2026-09-20');
  });
});
