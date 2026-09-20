/**
 * Data contract shared by the build pipeline (scripts/) and the web app (src/).
 *
 * Everything the app shows about a candidate is derived from `data/declarations/<candidate>.json`:
 * a declaration is a dated, sourced document (programme, vote, interview…) that sets the
 * candidate's position on one or more questions. The most recent declaration wins for each
 * question. There is no other channel to set a position: this is what makes the dataset auditable.
 */
import { z } from 'zod';

export const POSITION_VALUES = [-2, -1, 0, 1, 2] as const;
export type PositionValue = (typeof POSITION_VALUES)[number];

export const POSITION_LABELS: Record<PositionValue, string> = {
  [-2]: 'Fortement contre',
  [-1]: 'Plutôt contre',
  [0]: 'Position mitigée / neutre',
  [1]: 'Plutôt pour',
  [2]: 'Fortement pour',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ attendue');
const slug = z.string().regex(/^[a-z0-9-]+$/, 'Identifiant en minuscules, chiffres et tirets');

export const TopicSchema = z.object({
  id: slug,
  order: z.number().int().positive(),
  title: z.string().min(3),
  short: z.string().min(2),
  description: z.string().min(3),
});

export const QuestionSchema = z.object({
  id: z.string().regex(/^[a-z]{3}-\d{2}$/, 'Identifiant de question attendu : xxx-NN'),
  topic: slug,
  statement: z.string().min(10),
  context: z.string().optional(),
});

export const CANDIDATE_STATUSES = ['declared', 'designated', 'primary', 'potential', 'withdrawn'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];
export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  declared: 'Candidature déclarée',
  designated: 'Désigné(e) par son parti',
  primary: 'Candidat(e) à une primaire',
  potential: 'Candidature pressentie',
  withdrawn: 'Candidature retirée',
};

export const SourceRefSchema = z.object({
  title: z.string().min(3),
  url: z.string().url(),
  date: isoDate,
});

export const CandidateSchema = z.object({
  id: slug,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().min(3),
  party: z.string().min(2),
  partyShort: z.string().min(1),
  status: z.enum(CANDIDATE_STATUSES),
  declaredOn: isoDate.nullable(),
  statusNote: z.string().nullable(),
  primary: z.string().nullable(),
  website: z.string().url().nullable(),
  sources: z.array(SourceRefSchema).min(1, 'Chaque candidat doit citer au moins une source pour son statut'),
});

export const CandidatesFileSchema = z.object({
  election: z.object({
    name: z.string(),
    firstRound: isoDate,
    secondRound: isoDate,
    sponsorshipDeadline: isoDate,
    notes: z.string(),
  }),
  primaries: z.record(
    z.object({ name: z.string(), date: z.string(), organizers: z.string(), source: z.string().url() }),
  ),
  candidates: z.array(CandidateSchema),
});

export const SOURCE_TYPES = ['programme', 'discours', 'interview', 'tribune', 'vote', 'communique', 'presse', 'autre'] as const;
export const SOURCE_TYPE_LABELS: Record<(typeof SOURCE_TYPES)[number], string> = {
  programme: 'Programme officiel',
  discours: 'Discours',
  interview: 'Entretien',
  tribune: 'Tribune',
  vote: 'Vote ou proposition de loi',
  communique: 'Communiqué',
  presse: 'Article de presse',
  autre: 'Autre',
};

export const REVIEW_STATUSES = ['pending', 'verified', 'disputed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'En attente de vérification',
  verified: 'Vérifiée',
  disputed: 'Contestée',
};

export const DeclarationPositionSchema = z.object({
  questionId: z.string(),
  value: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]),
  /** Verbatim excerpt of the source that grounds this position. Required for any position added since the official-programme audit. */
  quote: z.string().min(8).optional(),
  /** Exact page of the source when it differs from the declaration's sourceUrl (sub-page, PDF page…). */
  sourceUrl: z.string().url().optional(),
  page: z.string().optional(),
  /** True when the source addresses a neighbouring measure and the position on the statement is deduced from it. */
  inferred: z.boolean().optional(),
  note: z.string().optional(),
});

export const DeclarationSchema = z.object({
  id: slug,
  date: isoDate,
  title: z.string().min(5),
  sourceType: z.enum(SOURCE_TYPES),
  sourceUrl: z.string().url(),
  publisher: z.string().min(2),
  summary: z.string().min(10),
  quote: z.string().optional(),
  review: z.object({
    status: z.enum(REVIEW_STATUSES),
    reviewers: z.array(z.string()),
    reviewedOn: isoDate.nullable(),
    notes: z.string().optional(),
  }),
  positions: z.array(DeclarationPositionSchema),
});

export const DeclarationsFileSchema = z.object({
  candidateId: slug,
  declarations: z.array(DeclarationSchema),
});

export type Topic = z.infer<typeof TopicSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type CandidatesFile = z.infer<typeof CandidatesFileSchema>;
export type Declaration = z.infer<typeof DeclarationSchema>;
export type DeclarationsFile = z.infer<typeof DeclarationsFileSchema>;

/** A candidate's current position on a question, with its provenance. Derived at build time. */
export interface DerivedPosition {
  value: PositionValue;
  declarationId: string;
  date: string;
  review: ReviewStatus;
  /** Exact page grounding the position (position-level override, else the declaration's URL). */
  sourceUrl: string;
  sourceTitle: string;
  sourceType: (typeof SOURCE_TYPES)[number];
  quote?: string;
  page?: string;
  inferred?: boolean;
  note?: string;
}

export interface CandidateRecord extends Candidate {
  positions: Record<string, DerivedPosition>;
  /** Date of the most recent declaration (null if none). */
  lastUpdated: string | null;
  stats: { known: number; verified: number; pending: number; disputed: number; declarations: number };
}

export interface DeclarationRecord extends Declaration {
  candidateId: string;
}

export interface Dataset {
  /** Short SHA-256 of the canonical JSON of data/ — printed in the app footer so anyone can reproduce it. */
  version: string;
  generatedAt: string;
  election: CandidatesFile['election'];
  primaries: CandidatesFile['primaries'];
  topics: Topic[];
  questions: Question[];
  candidates: CandidateRecord[];
  declarations: DeclarationRecord[];
  stats: {
    questions: number;
    candidates: number;
    positions: number;
    verified: number;
    pending: number;
    disputed: number;
    lastDeclarationDate: string | null;
  };
}
