import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ScaleInput from '../components/ScaleInput';
import { dataset, questionsByTopic } from '../lib/dataset';
import { isAnswered, type AnswerValue } from '../lib/matching';
import { useAppState } from '../state/AppState';

export default function Questionnaire() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { responses, setResponse, clearResponse, results } = useAppState();
  const topics = dataset.topics;
  const index = Math.max(
    0,
    topics.findIndex((t) => t.id === topicId),
  );
  const topic = topics[index];
  const questions = useMemo(() => questionsByTopic.get(topic.id) ?? [], [topic.id]);
  const [showContext, setShowContext] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!topicId) navigate(`/questionnaire/${topics[0].id}`, { replace: true });
  }, [topicId, navigate, topics]);

  const progress = topics.map((t) => {
    const qs = questionsByTopic.get(t.id) ?? [];
    const done = qs.filter((q) => responses[q.id] !== undefined).length;
    return { id: t.id, short: t.short, total: qs.length, done };
  });
  const totalDone = Object.keys(responses).length;
  const canSeeResults = results.answered >= results.options.minAnswered;
  const prev = topics[index - 1];
  const next = topics[index + 1];

  return (
    <div className="questionnaire">
      <aside className="topic-nav" aria-label="Thèmes">
        <p className="progress-total">
          {totalDone} / {dataset.stats.questions} questions traitées
        </p>
        <div className="progress-bar" aria-hidden="true">
          <div style={{ width: `${(totalDone / dataset.stats.questions) * 100}%` }} />
        </div>
        <ol>
          {progress.map((p, i) => (
            <li key={p.id} className={i === index ? 'current' : ''}>
              <Link to={`/questionnaire/${p.id}`}>
                <span>{p.short}</span>
                <span className="topic-count">
                  {p.done}/{p.total}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <Link className={`button ${canSeeResults ? 'primary' : 'disabled'}`} to="/resultats" aria-disabled={!canSeeResults}>
          Voir mes résultats
        </Link>
        {!canSeeResults && (
          <p className="hint">
            Répondez à au moins {results.options.minAnswered} questions ({results.answered} pour l'instant). Plus vous répondez, plus le résultat est
            fiable.
          </p>
        )}
      </aside>

      <section className="topic-section" aria-labelledby="topic-title">
        <p className="eyebrow">
          Thème {index + 1} sur {topics.length}
        </p>
        <h1 id="topic-title">{topic.title}</h1>
        <p className="lead">{topic.description}</p>

        <ol className="question-list">
          {questions.map((q, i) => {
            const r = responses[q.id];
            const value: AnswerValue | null = isAnswered(r) ? r.value : null;
            const important = isAnswered(r) ? r.important : false;
            const skipped = !!r && 'skipped' in r;
            return (
              <li key={q.id} className={`card question ${skipped ? 'skipped' : ''}`} id={q.id}>
                <p className="question-number">
                  Question {i + 1} · <code>{q.id}</code>
                </p>
                <p className="statement">{q.statement}</p>
                {q.context && (
                  <p className="context">
                    <button className="link" onClick={() => setShowContext((s) => ({ ...s, [q.id]: !s[q.id] }))} aria-expanded={!!showContext[q.id]}>
                      {showContext[q.id] ? 'Masquer le contexte' : 'Contexte'}
                    </button>
                    {showContext[q.id] && <span> {q.context}</span>}
                  </p>
                )}
                <ScaleInput name={q.id} value={value} onChange={(v) => setResponse(q.id, { value: v, important })} />
                <div className="question-actions">
                  <label className={`important ${value === null ? 'muted' : ''}`}>
                    <input
                      type="checkbox"
                      checked={important}
                      disabled={value === null}
                      onChange={(e) => value !== null && setResponse(q.id, { value, important: e.target.checked })}
                    />
                    Ce sujet compte beaucoup pour moi (poids ×2)
                  </label>
                  {skipped ? (
                    <button className="link" onClick={() => clearResponse(q.id)}>
                      Question passée — répondre
                    </button>
                  ) : (
                    <button className="link" onClick={() => setResponse(q.id, { skipped: true })}>
                      Passer cette question
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="pager">
          {prev ? (
            <Link className="button" to={`/questionnaire/${prev.id}`}>
              ← {prev.short}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className="button primary" to={`/questionnaire/${next.id}`}>
              {next.short} →
            </Link>
          ) : (
            <Link className={`button primary ${canSeeResults ? '' : 'disabled'}`} to="/resultats" aria-disabled={!canSeeResults}>
              Voir mes résultats
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
