import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { dataset } from '../lib/dataset';
import { formatDate } from '../lib/format';

export default function Candidates() {
  return (
    <>
      <h1>Candidat·es suivi·es</h1>
      <p className="lead">
        {dataset.stats.candidates} personnes déclarées, désignées, engagées dans une primaire ou pressenties, par ordre alphabétique. La liste
        officielle ne sera arrêtée par le Conseil constitutionnel qu'après la clôture des parrainages, le {formatDate(dataset.election.sponsorshipDeadline)}.
      </p>
      <ul className="candidate-grid">
        {dataset.candidates.map((c) => (
          <li key={c.id} className="card candidate-card">
            <h2>
              <Link to={`/candidats/${c.id}`}>{c.displayName}</Link>
            </h2>
            <p className="party">{c.party}</p>
            <StatusBadge status={c.status} />
            <dl>
              <dt>Positions documentées</dt>
              <dd>
                {c.stats.known} / {dataset.stats.questions} ({Math.round((c.stats.known / dataset.stats.questions) * 100)} %)
              </dd>
              <dt>Dernière déclaration</dt>
              <dd>{formatDate(c.lastUpdated)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
