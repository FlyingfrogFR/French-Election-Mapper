import { Link } from 'react-router-dom';
import { dataset } from '../lib/dataset';
import { formatDate, REPO_URL } from '../lib/format';

export default function About() {
  const sha = __COMMIT_SHA__;
  return (
    <>
      <h1>Transparence : vérifier par vous-même</h1>
      <p className="lead">
        L'objectif de cet outil est de ne déformer la position de personne. Cela ne se décrète pas : cela se vérifie. Voici comment.
      </p>

      <section className="card">
        <h2>Ce que vous voyez est ce qui est publié</h2>
        <dl className="kv">
          <dt>Dépôt de code</dt>
          <dd>
            <a href={REPO_URL} rel="noopener noreferrer">
              {REPO_URL}
            </a>
          </dd>
          <dt>Révision déployée</dt>
          <dd>
            <a href={`${REPO_URL}/commit/${sha}`} rel="noopener noreferrer">
              <code>{sha}</code>
            </a>
          </dd>
          <dt>Version du jeu de données</dt>
          <dd>
            <code>{dataset.version}</code> — générée le {formatDate(dataset.generatedAt.slice(0, 10))}
          </dd>
          <dt>Données brutes servies</dt>
          <dd>
            <a href={`${import.meta.env.BASE_URL}data/dataset.json`}>dataset.json</a> · <a href={`${import.meta.env.BASE_URL}data/VERSION`}>VERSION</a>
          </dd>
        </dl>
        <p>
          Pour vérifier : clonez le dépôt à cette révision, lancez <code>npm ci && npm run data:build</code> et comparez l'empreinte affichée avec{' '}
          <code>{dataset.version}</code>. Si elles diffèrent, les données affichées ne sont pas celles du dépôt.
        </p>
      </section>

      <section className="card">
        <h2>Comment une position entre dans la boussole</h2>
        <ol>
          <li>Quelqu'un ouvre une demande (issue) ou une proposition de modification (pull request) avec la source : lien, date, citation.</li>
          <li>La validation automatique vérifie le format, la présence d'une source et la cohérence avec les questions.</li>
          <li>Une deuxième personne relit la source et confirme l'encodage ; la déclaration passe de « en attente » à « vérifiée ».</li>
          <li>Le jeu de données est regénéré, son empreinte change, le site est redéployé. L'historique complet reste consultable.</li>
        </ol>
        <p>
          État actuel : {dataset.stats.verified} positions vérifiées, {dataset.stats.pending} en attente, {dataset.stats.disputed} contestées.
        </p>
      </section>

      <section className="card">
        <h2>Contribuer ou signaler une erreur</h2>
        <ul>
          <li>
            <a href={`${REPO_URL}/issues/new?template=declaration.yml`} rel="noopener noreferrer">
              Signaler une déclaration ou une erreur de position
            </a>
          </li>
          <li>
            <a href={`${REPO_URL}/issues/new?template=question.yml`} rel="noopener noreferrer">
              Proposer ou contester une question
            </a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md`} rel="noopener noreferrer">
              Guide de contribution
            </a>{' '}
            ·{' '}
            <a href={`${REPO_URL}/blob/main/docs/CHARTE-EDITORIALE.md`} rel="noopener noreferrer">
              Charte éditoriale
            </a>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Ce que l'outil ne fait pas</h2>
        <ul>
          <li>Il ne pondère pas les candidat·es selon les sondages, leur notoriété ou leur « chance de gagner ».</li>
          <li>Il n'attribue jamais une position par défaut : une position inconnue est exclue du calcul.</li>
          <li>Il ne classe pas les candidatures seulement pressenties.</li>
          <li>Il ne collecte aucune donnée sans votre consentement explicite, et jamais vos réponses.</li>
        </ul>
        <p>
          <Link to="/methodologie">Méthode</Link> · <Link to="/confidentialite">Confidentialité</Link>
        </p>
      </section>
    </>
  );
}
