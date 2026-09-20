import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, InferredBadge, PositionChip, Quote, ReviewBadge, StatusBadge } from '../components/Badges';
import { ANSWER_LABELS } from '../components/ScaleInput';
import { candidateById, dataset, questionsByTopic } from '../lib/dataset';
import { buildAnonymousPayload, feedbackEndpoint, sendAnonymousFeedback } from '../lib/feedback';
import { formatDate } from '../lib/format';
import { CONFIDENCE_WEIGHTS, percent, type CandidateResult } from '../lib/matching';
import { exportState, loadState, type Feedback } from '../lib/storage';
import { useAppState } from '../state/AppState';

const EXCLUSION_LABELS = {
  status: 'candidature seulement pressentie : non classée',
  coverage: 'trop peu de positions connues sur les questions auxquelles vous avez répondu',
  'no-positions': 'aucune position documentée pour l’instant',
} as const;

function downloadJson(name: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Results() {
  const { results, feedback, setFeedback, reset } = useAppState();
  const [compare, setCompare] = useState<string[]>([]);
  const [sending, setSending] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [consent, setConsent] = useState(false);
  const [expected, setExpected] = useState<string>('');

  const selected = useMemo(() => {
    const ids = compare.length ? compare : results.ranking.slice(0, 3).map((r) => r.candidate.id);
    return ids.map((id) => results.ranking.find((r) => r.candidate.id === id) ?? results.excluded.find((r) => r.candidate.id === id)).filter(Boolean) as CandidateResult[];
  }, [compare, results]);

  if (!results.top || !results.confidence) {
    return (
      <div className="card">
        <h1>Pas encore de résultat</h1>
        <p>
          Il faut au moins {results.options.minAnswered} réponses pour établir un classement ; vous en avez {results.answered}.
        </p>
        <Link className="button primary" to="/questionnaire">
          Continuer le questionnaire
        </Link>
      </div>
    );
  }

  const top = results.top;
  const conf = results.confidence;
  const endpoint = feedbackEndpoint();

  function giveFeedback(agreement: Feedback['agreement']) {
    setFeedback({
      suggestedCandidateId: top.candidate.id,
      agreement,
      expectedCandidateId: agreement === 'yes' ? null : expected || null,
      createdAt: new Date().toISOString(),
      datasetVersion: dataset.version,
      sentAnonymously: false,
    });
  }

  async function send() {
    if (!feedback || !consent) return;
    setSending('sending');
    const ok = await sendAnonymousFeedback(buildAnonymousPayload(feedback, results));
    setSending(ok ? 'sent' : 'failed');
    if (ok) setFeedback({ ...feedback, sentAnonymously: true });
  }

  return (
    <>
      <section className="card top-result">
        <p className="eyebrow">Candidat·e le plus proche de vos réponses</p>
        <h1>
          <Link to={`/candidats/${top.candidate.id}`}>{top.candidate.displayName}</Link>{' '}
          <small>
            {top.candidate.party} · <StatusBadge status={top.candidate.status} />
          </small>
        </h1>
        <div className="grid two">
          <div>
            <p className="metric">
              <span className="metric-value">{percent(top.score)}</span>
              <span className="metric-label">d'affinité sur {top.used} questions comparées</span>
            </p>
          </div>
          <div>
            <p className="metric">
              <span className="metric-value">{conf.score} %</span>
              <span className="metric-label">d'indice de confiance dans cette suggestion</span>
            </p>
          </div>
        </div>
        <details>
          <summary>Comment cet indice de confiance est-il calculé ?</summary>
          <ul>
            <li>
              Nombre de réponses : {Math.round(conf.components.answers * 100)} % (poids {CONFIDENCE_WEIGHTS.answers}) — {results.answered} réponses, maximum atteint à{' '}
              {results.options.fullConfidenceAnswers}.
            </li>
            <li>
              Couverture : {Math.round(conf.components.coverage * 100)} % (poids {CONFIDENCE_WEIGHTS.coverage}) — part de vos réponses pour lesquelles la position de{' '}
              {top.candidate.lastName} est connue.
            </li>
            <li>
              Vérification des sources : {Math.round(conf.components.verified * 100)} % (poids {CONFIDENCE_WEIGHTS.verified}) — {Math.round(top.verifiedShare * 100)} % des
              positions utilisées ont été relues par deux personnes.
            </li>
            <li>
              Écart avec le ou la deuxième : {Math.round(conf.components.margin * 100)} % (poids {CONFIDENCE_WEIGHTS.margin}) —{' '}
              {results.runnerUp ? `${results.runnerUp.candidate.displayName} obtient ${percent(results.runnerUp.score)}` : 'pas de second·e'}.
            </li>
          </ul>
          <p>
            <Link to="/methodologie">Méthode complète</Link>.
          </p>
        </details>
      </section>

      <section className="card feedback" aria-labelledby="fb-title">
        <h2 id="fb-title">Ce résultat vous paraît-il juste ?</h2>
        {!feedback ? (
          <>
            <p>
              Votre avis sert à mesurer la qualité de la boussole. Il est enregistré uniquement sur votre appareil{endpoint ? ', sauf si vous choisissez ensuite de l’envoyer anonymement' : ''}.
            </p>
            <div className="cta-row">
              <button className="button primary" onClick={() => giveFeedback('yes')}>
                Oui, je suis d'accord
              </button>
              <button className="button" onClick={() => giveFeedback('partly')}>
                En partie
              </button>
              <button className="button" onClick={() => giveFeedback('no')}>
                Non
              </button>
            </div>
            <label className="expected">
              Si vous n'êtes pas d'accord, quelle personne attendiez-vous ?{' '}
              <select value={expected} onChange={(e) => setExpected(e.target.value)}>
                <option value="">— facultatif —</option>
                {dataset.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({c.partyShort})
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <p>
              Merci. Vous avez indiqué :{' '}
              <strong>{{ yes: 'd’accord', partly: 'en partie d’accord', no: 'pas d’accord' }[feedback.agreement]}</strong>
              {feedback.expectedCandidateId && candidateById.get(feedback.expectedCandidateId) && (
                <>
                  {' '}
                  (vous attendiez {candidateById.get(feedback.expectedCandidateId)?.displayName})
                </>
              )}
              .{' '}
              <button className="link" onClick={() => setFeedback(null)}>
                Modifier
              </button>
            </p>
            {endpoint && !feedback.sentAnonymously && (
              <div className="consent">
                <label>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  J'accepte d'envoyer <strong>anonymement</strong> les informations suivantes, et rien d'autre : candidat·e suggéré·e, mon avis, la
                  personne attendue le cas échéant, l'affinité et l'indice de confiance arrondis à la dizaine, une tranche de nombre de réponses et la
                  version des données. Ni mes réponses, ni mon adresse IP, ni aucun identifiant ne sont conservés.
                </label>
                <button className="button" disabled={!consent || sending === 'sending'} onClick={send}>
                  {sending === 'sending' ? 'Envoi…' : 'Envoyer anonymement'}
                </button>
                {sending === 'failed' && <p className="error">L'envoi a échoué. Votre avis reste enregistré sur cet appareil.</p>}
              </div>
            )}
            {feedback.sentAnonymously && <p className="ok">Avis anonyme envoyé. Merci !</p>}
          </>
        )}
      </section>

      <section className="card">
        <h2>Classement complet</h2>
        <p className="hint">
          Affinité = moyenne pondérée de l'accord entre vos réponses et les positions connues. Couverture = part de vos réponses pour lesquelles une
          position est documentée.
        </p>
        <table className="ranking">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Candidat·e</th>
              <th scope="col">Affinité</th>
              <th scope="col">Couverture</th>
              <th scope="col">Comparer</th>
            </tr>
          </thead>
          <tbody>
            {results.ranking.map((r, i) => (
              <tr key={r.candidate.id}>
                <td>{i + 1}</td>
                <td>
                  <Link to={`/candidats/${r.candidate.id}`}>{r.candidate.displayName}</Link>
                  <br />
                  <small>{r.candidate.party}</small>
                </td>
                <td>
                  <Bar value={r.score} />
                </td>
                <td>
                  {percent(r.coverage)} <small>({r.used} q.)</small>
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Comparer ${r.candidate.displayName}`}
                    checked={selected.some((s) => s.candidate.id === r.candidate.id)}
                    onChange={(e) => {
                      const base = selected.map((s) => s.candidate.id);
                      setCompare(e.target.checked ? [...base, r.candidate.id] : base.filter((id) => id !== r.candidate.id));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.excluded.length > 0 && (
          <details>
            <summary>{results.excluded.length} candidat·es non classé·es</summary>
            <ul>
              {results.excluded.map((r) => (
                <li key={r.candidate.id}>
                  <Link to={`/candidats/${r.candidate.id}`}>{r.candidate.displayName}</Link> ({r.candidate.partyShort}) — {EXCLUSION_LABELS[r.exclusionReason ?? 'no-positions']}
                  {r.score !== null && r.exclusionReason !== 'status' && (
                    <>
                      {' '}
                      · affinité indicative {percent(r.score)} sur {r.used} question{r.used > 1 ? 's' : ''}
                    </>
                  )}
                  .
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card">
        <h2>Affinité par thème</h2>
        <div className="table-scroll">
          <table className="topics-table">
            <thead>
              <tr>
                <th scope="col">Thème</th>
                {selected.map((s) => (
                  <th key={s.candidate.id} scope="col">
                    {s.candidate.lastName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataset.topics.map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.title}</th>
                  {selected.map((s) => {
                    const ts = s.byTopic.find((x) => x.topicId === t.id);
                    return (
                      <td key={s.candidate.id}>
                        {ts && ts.score !== null ? (
                          <>
                            {percent(ts.score)} <small>({ts.used}/{ts.answered})</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Question par question</h2>
        <p className="hint">Chaque position renvoie vers sa source. « Position inconnue » signifie qu'aucune déclaration n'a encore été documentée.</p>
        {dataset.topics.map((t) => {
          const qs = (questionsByTopic.get(t.id) ?? []).filter((q) => top.questions.some((m) => m.question.id === q.id));
          if (!qs.length) return null;
          return (
            <details key={t.id} className="topic-details">
              <summary>{t.title}</summary>
              <div className="table-scroll">
                <table className="compare">
                  <thead>
                    <tr>
                      <th scope="col">Affirmation</th>
                      <th scope="col">Vous</th>
                      {selected.map((s) => (
                        <th key={s.candidate.id} scope="col">
                          {s.candidate.lastName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {qs.map((q) => {
                      const mine = top.questions.find((m) => m.question.id === q.id);
                      return (
                        <tr key={q.id}>
                          <td>
                            {q.statement}
                            {mine?.important && <span className="pill">important</span>}
                          </td>
                          <td>{mine ? ANSWER_LABELS[mine.userValue] : '—'}</td>
                          {selected.map((s) => {
                            const p = s.candidate.positions[q.id];
                            return (
                              <td key={s.candidate.id}>
                                <PositionChip value={p ? p.value : null} />
                                {p && (
                                  <div className="source-line">
                                    <a href={p.sourceUrl} rel="noopener noreferrer">
                                      source
                                    </a>{' '}
                                    · {formatDate(p.date)} · <ReviewBadge status={p.review} /> <InferredBadge inferred={p.inferred} />
                                    <Quote text={p.quote} />
                                    {p.note && <div className="note">{p.note}</div>}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>

      <section className="card">
        <h2>Vos données</h2>
        <div className="cta-row">
          <Link className="button" to="/questionnaire">
            Modifier mes réponses
          </Link>
          <button className="button" onClick={() => downloadJson('boussole-2027-mes-donnees.json', exportState(loadState()))}>
            Exporter mes données (JSON)
          </button>
          <button
            className="button danger"
            onClick={() => {
              if (window.confirm('Effacer toutes vos réponses et votre avis de cet appareil ?')) reset();
            }}
          >
            Effacer toutes mes données
          </button>
        </div>
      </section>
    </>
  );
}
