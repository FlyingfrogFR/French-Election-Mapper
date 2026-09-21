import { Link, useParams } from 'react-router-dom';
import { InferredBadge, PositionChip, Quote, ReviewBadge, StatusBadge } from '../components/Badges';
import { candidateById, dataset, questionsByTopic } from '../lib/dataset';
import { formatDate } from '../lib/format';
import { quoteKey, useQuotes } from '../lib/quotes';
import { SOURCE_TYPE_LABELS } from '../lib/schema';
import NotFound from './NotFound';

export default function CandidateDetail() {
  const { candidateId } = useParams();
  const quotes = useQuotes();
  const c = candidateId ? candidateById.get(candidateId) : undefined;
  if (!c) return <NotFound />;
  const decls = dataset.declarations.filter((d) => d.candidateId === c.id);
  const primary = c.primary ? dataset.primaries[c.primary] : null;
  return (
    <>
      <p>
        <Link to="/candidats">← Tous les candidat·es</Link>
      </p>
      <h1>{c.displayName}</h1>
      <p className="lead">
        {c.party} · <StatusBadge status={c.status} />
        {c.declaredOn && <> · depuis le {formatDate(c.declaredOn)}</>}
      </p>
      {c.statusNote && <p>{c.statusNote}</p>}
      {primary && (
        <p>
          Primaire : {primary.name} ({primary.date}, organisée par {primary.organizers}).
        </p>
      )}
      <p>
        {c.website && (
          <>
            <a href={c.website} rel="noopener noreferrer">
              Site officiel
            </a>{' '}
            ·{' '}
          </>
        )}
        Sources du statut :{' '}
        {c.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} rel="noopener noreferrer">
              {s.title}
            </a>{' '}
            ({formatDate(s.date)})
          </span>
        ))}
      </p>

      <section className="card">
        <h2>Positions documentées</h2>
        <p>
          {c.stats.known} position{c.stats.known > 1 ? 's' : ''} sur {dataset.stats.questions} questions — {c.stats.verified} vérifiée
          {c.stats.verified > 1 ? 's' : ''}, {c.stats.pending} en attente, {c.stats.disputed} contestée{c.stats.disputed > 1 ? 's' : ''}. Une position
          absente n'est jamais devinée : elle est simplement exclue du calcul.{' '}
          <Link to="/transparence">Signaler une erreur ou proposer une source</Link>.
        </p>
        {c.stats.known === 0 && <p className="notice warn">Aucune position documentée pour l'instant : cette personne ne peut pas encore être classée.</p>}
        {dataset.topics.map((t) => {
          const qs = (questionsByTopic.get(t.id) ?? []).filter((q) => c.positions[q.id]);
          if (!qs.length) return null;
          return (
            <details key={t.id} className="topic-details" open>
              <summary>
                {t.title} <small>({qs.length})</small>
              </summary>
              <ul className="position-list">
                {qs.map((q) => {
                  const p = c.positions[q.id];
                  return (
                    <li key={q.id}>
                      <p className="statement">{q.statement}</p>
                      <p>
                        <PositionChip value={p.value} />{' '}
                        <a href={p.sourceUrl} rel="noopener noreferrer">
                          {p.sourceTitle}
                        </a>{' '}
                        {quotes[quoteKey(c.id, q.id)]?.page && <> (p. {quotes[quoteKey(c.id, q.id)]?.page})</>} · {SOURCE_TYPE_LABELS[p.sourceType]} · {formatDate(p.date)} · <ReviewBadge status={p.review} />{' '}
                        <InferredBadge inferred={p.inferred} />
                      </p>
                      <Quote text={quotes[quoteKey(c.id, q.id)]?.quote} />
                      {p.note && <p className="note">{p.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </section>

      <section className="card">
        <h2>Déclarations utilisées ({decls.length})</h2>
        <ol className="timeline">
          {decls.map((d) => (
            <li key={d.id}>
              <p>
                <strong>{formatDate(d.date)}</strong> — {d.title} <small>({SOURCE_TYPE_LABELS[d.sourceType]}, {d.publisher})</small>{' '}
                <ReviewBadge status={d.review.status} />
              </p>
              <p>{d.summary}</p>
              {d.quote && <blockquote>{d.quote}</blockquote>}
              <p>
                <a href={d.sourceUrl} rel="noopener noreferrer">
                  Consulter la source
                </a>{' '}
                · {d.positionCount} position{d.positionCount > 1 ? 's' : ''} renseignée{d.positionCount > 1 ? 's' : ''} · identifiant <code>{d.id}</code>
              </p>
              {d.review.notes && <p className="note">{d.review.notes}</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
