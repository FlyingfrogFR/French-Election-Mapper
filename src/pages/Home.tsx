import { Link } from 'react-router-dom';
import FreshnessBanner from '../components/FreshnessBanner';
import { dataset } from '../lib/dataset';
import { formatDate } from '../lib/format';
import { DEFAULT_OPTIONS } from '../lib/matching';
import { useAppState } from '../state/AppState';

export default function Home() {
  const { results, noticeSeen, markNoticeSeen, mode, setMode } = useAppState();
  // Only candidacies whose positions are actually documented can be compared, so that is the number to show.
  const documented = dataset.candidates.filter((c) => DEFAULT_OPTIONS.includeStatuses.includes(c.status) && c.stats.known > 0).length;
  return (
    <>
      <section className="hero">
        <h1>Quel·le candidat·e à la présidentielle 2027 est le plus proche de vos idées ?</h1>
        <p className="lead">
          Répondez à {dataset.stats.questions} questions réparties en {dataset.topics.length} thèmes. La boussole compare vos réponses aux positions
          documentées de {documented} candidat·es et vous indique la personne la plus proche, avec un indice de confiance. Puis vous nous dites si
          vous êtes d'accord.
        </p>
        <div className="cta-row">
          <Link className="button primary" to="/questionnaire">
            {results.answered > 0 ? `Reprendre le questionnaire (${results.answered} réponses)` : 'Commencer le questionnaire'}
          </Link>
          {results.top && (
            <Link className="button" to="/resultats">
              Voir mes résultats
            </Link>
          )}
          <Link className="button ghost" to="/candidats">
            Parcourir les positions des candidat·es
          </Link>
        </div>
      </section>

      {!noticeSeen && (
        <section className="card notice-card" aria-labelledby="notice-title">
          <h2 id="notice-title">Avant de commencer : vos données restent chez vous</h2>
          <p>
            Vos réponses portent sur vos opinions politiques, une donnée sensible. Elles sont traitées <strong>uniquement dans votre navigateur</strong>{' '}
            : aucun serveur ne les reçoit, il n'y a ni compte, ni cookie, ni traceur. Vous pouvez les exporter ou les effacer à tout moment.
          </p>
          <fieldset className="mode-choice">
            <legend>Conservation sur cet appareil</legend>
            <label>
              <input type="radio" name="mode" checked={mode === 'local'} onChange={() => setMode('local')} />
              Conserver mes réponses pour pouvoir reprendre plus tard (stockage local du navigateur)
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'session'} onChange={() => setMode('session')} />
              Ne rien conserver : tout est effacé à la fermeture de l'onglet
            </label>
          </fieldset>
          <p>
            <button className="button" onClick={markNoticeSeen}>
              J'ai compris
            </button>{' '}
            <Link to="/confidentialite">Lire la politique de confidentialité</Link>
          </p>
        </section>
      )}

      <section className="grid three">
        <div className="card">
          <h2>1. Vous répondez</h2>
          <p>
            Pour chaque affirmation, dites si vous êtes d'accord, sur une échelle en cinq points. Vous pouvez passer une question et signaler celles
            qui comptent le plus pour vous.
          </p>
        </div>
        <div className="card">
          <h2>2. La boussole compare</h2>
          <p>
            Chaque position de candidat·e provient d'une déclaration datée et sourcée (programme, vote, entretien). Le calcul est public,
            déterministe et <Link to="/methodologie">expliqué pas à pas</Link>.
          </p>
        </div>
        <div className="card">
          <h2>3. Vous confirmez</h2>
          <p>
            Vous voyez la personne la plus proche, l'indice de confiance, le détail par thème et question par question. Puis vous nous dites si le
            résultat vous paraît juste.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Données et mises à jour</h2>
        <FreshnessBanner />
        <ul className="stats">
          <li>
            <strong>{dataset.stats.candidates}</strong> candidat·es suivi·es
          </li>
          <li>
            <strong>{dataset.stats.positions}</strong> positions documentées
          </li>
          <li>
            <strong>{dataset.declarations.length}</strong> déclarations sourcées
          </li>
          <li>
            Premier tour le <strong>{formatDate(dataset.election.firstRound)}</strong>
          </li>
        </ul>
        <p>
          Les positions sont mises à jour au moins chaque semaine à partir des déclarations publiques des candidat·es. Chaque modification est
          publique, datée et relue. <Link to="/transparence">Comment vérifier par vous-même</Link>.
        </p>
      </section>
    </>
  );
}
