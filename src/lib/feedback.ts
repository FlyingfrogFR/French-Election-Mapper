/**
 * Optional, anonymous, opt-in feedback. Sends only coarse buckets — never the answers, never an identifier.
 * Nothing is sent unless VITE_FEEDBACK_ENDPOINT is configured at build time AND the user ticks the box.
 */
import type { Results } from './matching';
import type { Feedback } from './storage';

export interface AnonymousFeedbackPayload {
  v: 1;
  datasetVersion: string;
  suggested: string;
  agreement: Feedback['agreement'];
  expected: string | null;
  matchBucket: string;
  confidenceBucket: string;
  answeredBucket: string;
}

export function bucket10(x: number): string {
  const lo = Math.min(90, Math.floor(x / 10) * 10);
  return `${lo}-${lo + 9}`;
}

export function answeredBucket(n: number): string {
  if (n < 20) return '<20';
  if (n < 40) return '20-39';
  if (n < 80) return '40-79';
  if (n < 120) return '80-119';
  return '120+';
}

export function buildAnonymousPayload(feedback: Feedback, results: Results): AnonymousFeedbackPayload {
  const match = results.top?.score ?? 0;
  return {
    v: 1,
    datasetVersion: feedback.datasetVersion,
    suggested: feedback.suggestedCandidateId,
    agreement: feedback.agreement,
    expected: feedback.expectedCandidateId,
    matchBucket: bucket10(match * 100),
    confidenceBucket: bucket10(results.confidence?.score ?? 0),
    answeredBucket: answeredBucket(results.answered),
  };
}

export function feedbackEndpoint(): string | null {
  const url = import.meta.env.VITE_FEEDBACK_ENDPOINT?.trim();
  return url ? url : null;
}

export async function sendAnonymousFeedback(payload: AnonymousFeedbackPayload): Promise<boolean> {
  const endpoint = feedbackEndpoint();
  if (!endpoint) return false;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
