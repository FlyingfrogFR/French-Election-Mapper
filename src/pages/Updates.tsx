import { Link } from 'react-router-dom';
import { ReviewBadge } from '../components/Badges';
import FreshnessBanner from '../components/FreshnessBanner';
import { candidateById, dataset } from '../lib/dataset';
import { formatDate, isoWeek, REPO_URL } from '../lib/format';
import { SOURCE_TYPE_LABELS } from '../lib/schema';

export default function Updates() {
  const weeks = new Map<string, typeof dataset.declarations>();
  for (const d of dataset.declarations) {
    const w = isoWeek(d.date);
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  }
  return (
    <>
      <h1>Journal des mises à jour</h1>
      <p className="lead">
        Toutes les déclarations qui alimentent la boussole, semaine par semaine. Chaque entrée est publique, datée, sourcée et relue ; le détail des
        changements est consultable dans l'historique du dépôt.
      </p>
      <FreshnessBanner />
      <p>
        <a href={`${import.meta.env.BASE_URL}data/updates.xml`}>Flux RSS</a> ·{' '}
        <a href={`${REPO_URL}/issues?q=label%3Amise-a-jour-hebdo`} rel="noopener noreferrer">
          Suivi hebdomadaire
        </a>{' '}
        · <Link to="/transparence">Proposer une déclaration</Link>
      </p>
      {[...weeks.entries()].map(([week, decls]) => (
        <section key={week} className="card">
          <h2>Semaine {week}</h2>
          <ul className="update-list">
            {decls.map((d) => {
              const c = candidateById.get(d.candidateId);
              return (
                <li key={d.id}>
                  <p>
                    <strong>{formatDate(d.date)}</strong> · <Link to={`/candidats/${d.candidateId}`}>{c?.displayName ?? d.candidateId}</Link>{' '}
                    <small>({c?.partyShort})</small> — {d.title} <small>({SOURCE_TYPE_LABELS[d.sourceType]})</small> <ReviewBadge status={d.review.status} />
                  </p>
                  <p>{d.summary}</p>
                  <p>
                    <a href={d.sourceUrl} rel="noopener noreferrer">
                      Source
                    </a>{' '}
                    · {d.positions.length} position{d.positions.length > 1 ? 's' : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
