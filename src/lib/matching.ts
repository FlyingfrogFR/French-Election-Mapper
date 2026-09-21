/**
 * Matching engine. Pure, deterministic, dependency-free: given the dataset and the user's answers it
 * returns a ranking and a confidence index. Documented in docs/METHODOLOGIE.md — keep both in sync.
 */
import type { CandidateRecord, CandidateStatus, Dataset, DerivedPosition, PositionValue, Question } from './schema';

export type AnswerValue = PositionValue;

export type Response = { value: AnswerValue; important: boolean } | { skipped: true };
export type Responses = Record<string, Response>;

export interface MatchingOptions {
  /** Below this number of answered questions no ranking is produced. */
  minAnswered: number;
  /** A candidate needs a known position on at least this share of the answered questions to be ranked. */
  minCoverage: number;
  /** Weight of a question the user flagged as important (a normal question weighs 1). */
  importantWeight: number;
  /** Only candidates in these statuses are ranked; others are listed separately. */
  includeStatuses: CandidateStatus[];
  /** Number of answered questions at which the "answers" confidence component reaches 100 %. */
  fullConfidenceAnswers: number;
  /** Score gap (0..1) between 1st and 2nd at which the "margin" component reaches 100 %. */
  marginForFullConfidence: number;
}

export const DEFAULT_OPTIONS: MatchingOptions = {
  minAnswered: 10,
  minCoverage: 0.5,
  importantWeight: 2,
  includeStatuses: ['declared', 'designated', 'primary'],
  fullConfidenceAnswers: 40,
  marginForFullConfidence: 0.1,
};

export const CONFIDENCE_WEIGHTS = { answers: 0.3, coverage: 0.25, verified: 0.15, margin: 0.3 } as const;

export interface QuestionMatch {
  question: Question;
  userValue: AnswerValue;
  important: boolean;
  weight: number;
  position: DerivedPosition | null;
  /** 1 = identical position, 0 = opposite extremes, null = candidate position unknown. */
  agreement: number | null;
}

export interface TopicScore {
  topicId: string;
  score: number | null;
  answered: number;
  used: number;
}

export type ExclusionReason = 'status' | 'coverage' | 'no-positions';

export interface CandidateResult {
  candidate: CandidateRecord;
  /** Weighted average agreement over the answered questions with a known position (0..1). */
  score: number | null;
  /** Share of the answered questions for which the candidate has a known position (0..1). */
  coverage: number;
  used: number;
  verifiedShare: number;
  byTopic: TopicScore[];
  questions: QuestionMatch[];
  eligible: boolean;
  exclusionReason?: ExclusionReason;
}

export interface Confidence {
  score: number;
  components: { answers: number; coverage: number; verified: number; margin: number };
}

export interface Results {
  answered: number;
  skipped: number;
  total: number;
  ranking: CandidateResult[];
  excluded: CandidateResult[];
  top: CandidateResult | null;
  runnerUp: CandidateResult | null;
  confidence: Confidence | null;
  options: MatchingOptions;
}

export function isAnswered(r: Response | undefined): r is { value: AnswerValue; important: boolean } {
  return !!r && !('skipped' in r);
}

/** Agreement between two positions on the -2..2 scale: 1 when identical, 0 when opposite extremes. */
export function agreement(user: AnswerValue, candidate: PositionValue): number {
  return 1 - Math.abs(user - candidate) / 4;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function scoreCandidate(
  candidate: CandidateRecord,
  answered: Array<{ question: Question; value: AnswerValue; important: boolean }>,
  topics: Dataset['topics'],
  options: MatchingOptions,
): CandidateResult {
  const questions: QuestionMatch[] = answered.map(({ question, value, important }) => {
    const position = candidate.positions[question.id] ?? null;
    return {
      question,
      userValue: value,
      important,
      weight: important ? options.importantWeight : 1,
      position,
      agreement: position ? agreement(value, position.value) : null,
    };
  });

  let weightSum = 0;
  let agreementSum = 0;
  let used = 0;
  let verified = 0;
  for (const q of questions) {
    if (q.agreement === null || !q.position) continue;
    used++;
    weightSum += q.weight;
    agreementSum += q.weight * q.agreement;
    if (q.position.review === 'verified') verified++;
  }

  const byTopic: TopicScore[] = topics.map((t) => {
    const qs = questions.filter((q) => q.question.topic === t.id);
    let w = 0;
    let s = 0;
    let n = 0;
    for (const q of qs) {
      if (q.agreement === null) continue;
      w += q.weight;
      s += q.weight * q.agreement;
      n++;
    }
    return { topicId: t.id, score: w > 0 ? s / w : null, answered: qs.length, used: n };
  });

  const coverage = answered.length ? used / answered.length : 0;
  const statusOk = options.includeStatuses.includes(candidate.status);
  let exclusionReason: ExclusionReason | undefined;
  if (!statusOk) exclusionReason = 'status';
  else if (used === 0) exclusionReason = 'no-positions';
  else if (coverage < options.minCoverage) exclusionReason = 'coverage';

  return {
    candidate,
    score: weightSum > 0 ? agreementSum / weightSum : null,
    coverage,
    used,
    verifiedShare: used ? verified / used : 0,
    byTopic,
    questions,
    eligible: !exclusionReason,
    ...(exclusionReason ? { exclusionReason } : {}),
  };
}

export function computeConfidence(
  top: CandidateResult,
  runnerUp: CandidateResult | null,
  answeredCount: number,
  options: MatchingOptions,
): Confidence {
  const answers = clamp01(answeredCount / options.fullConfidenceAnswers);
  const coverage = clamp01(top.coverage);
  const verified = 0.6 + 0.4 * clamp01(top.verifiedShare);
  const gap = runnerUp && runnerUp.score !== null && top.score !== null ? top.score - runnerUp.score : 1;
  const margin = clamp01(gap / options.marginForFullConfidence);
  const score =
    CONFIDENCE_WEIGHTS.answers * answers +
    CONFIDENCE_WEIGHTS.coverage * coverage +
    CONFIDENCE_WEIGHTS.verified * verified +
    CONFIDENCE_WEIGHTS.margin * margin;
  return { score: Math.round(score * 100), components: { answers, coverage, verified, margin } };
}

export function computeResults(dataset: Dataset, responses: Responses, opts: Partial<MatchingOptions> = {}): Results {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const answered: Array<{ question: Question; value: AnswerValue; important: boolean }> = [];
  let skipped = 0;
  for (const question of dataset.questions) {
    const r = responses[question.id];
    if (isAnswered(r)) answered.push({ question, value: r.value, important: r.important });
    else if (r && 'skipped' in r) skipped++;
  }

  const all = dataset.candidates.map((c) => scoreCandidate(c, answered, dataset.topics, options));
  const enough = answered.length >= options.minAnswered;
  const ranking = enough
    ? all
        .filter((r) => r.eligible && r.score !== null)
        // Ties are broken alphabetically so that the order never depends on file order.
        .sort((a, b) => (b.score as number) - (a.score as number) || a.candidate.lastName.localeCompare(b.candidate.lastName, 'fr'))
    : [];
  const rankedIds = new Set(ranking.map((r) => r.candidate.id));
  const excluded = all
    .filter((r) => !rankedIds.has(r.candidate.id))
    .sort((a, b) => a.candidate.lastName.localeCompare(b.candidate.lastName, 'fr'));
  const top = ranking[0] ?? null;
  const runnerUp = ranking[1] ?? null;

  return {
    answered: answered.length,
    skipped,
    total: dataset.questions.length,
    ranking,
    excluded,
    top,
    runnerUp,
    confidence: top ? computeConfidence(top, runnerUp, answered.length, options) : null,
    options,
  };
}

export const percent = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`);
