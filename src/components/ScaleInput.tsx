import type { AnswerValue } from '../lib/matching';

export const ANSWER_LABELS: Record<AnswerValue, string> = {
  [-2]: "Pas du tout d'accord",
  [-1]: "Plutôt pas d'accord",
  [0]: 'Partagé·e / neutre',
  [1]: "Plutôt d'accord",
  [2]: "Tout à fait d'accord",
};

const VALUES: AnswerValue[] = [-2, -1, 0, 1, 2];

interface Props {
  name: string;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
}

export default function ScaleInput({ name, value, onChange }: Props) {
  return (
    <div className="scale" role="radiogroup" aria-label="Votre position">
      {VALUES.map((v) => (
        <label key={v} className={`scale-option v${v} ${value === v ? 'selected' : ''}`}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span className="scale-dot" aria-hidden="true" />
          <span className="scale-label">{ANSWER_LABELS[v]}</span>
        </label>
      ))}
    </div>
  );
}
