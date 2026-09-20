import { CANDIDATE_STATUS_LABELS, POSITION_LABELS, REVIEW_STATUS_LABELS, type CandidateStatus, type PositionValue, type ReviewStatus } from '../lib/schema';

export function StatusBadge({ status }: { status: CandidateStatus }) {
  return <span className={`badge status-${status}`}>{CANDIDATE_STATUS_LABELS[status]}</span>;
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`badge review-${status}`} title="Statut de relecture de la source">
      {REVIEW_STATUS_LABELS[status]}
    </span>
  );
}

export function PositionChip({ value }: { value: PositionValue | null }) {
  if (value === null) return <span className="chip unknown">Position inconnue</span>;
  return <span className={`chip v${value}`}>{POSITION_LABELS[value]}</span>;
}

export function Bar({ value, label }: { value: number | null; label?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div className="bar" role="img" aria-label={label ?? `${pct} %`}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      <span className="bar-value">{value === null ? '—' : `${pct} %`}</span>
    </div>
  );
}
