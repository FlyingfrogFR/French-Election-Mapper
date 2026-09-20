import { Link } from 'react-router-dom';
import { dataset } from '../lib/dataset';
import { REPO_URL } from '../lib/format';
import { CONFIDENCE_WEIGHTS, DEFAULT_OPTIONS } from '../lib/matching';

export default function Methodology() {
  const o = DEFAULT_OPTIONS;
  return (
    <>
      <h1>Méthode de calcul</h1>
      <p className="lead">
        Tout ce qui est décrit ici est implémenté dans un seul fichier public, <code>src/lib/matching.ts</code>, couvert par des tests automatiques.
        Les valeurs ci-dessous sont lues directement dans le code : ce que vous lisez est ce qui tourne.
      </p>

      <section className="card">
        <h2>1. L'échelle</h2>
        <p>
          Vous et les candidat·es êtes placé·es sur la même échelle en cinq points, de −2 (« pas du tout d'accord » / « fortement contre ») à +2
          (« tout à fait d'accord » / « fortement pour »). Le 0 signifie « partagé·e » ou « position mitigée ». Une question passée n'est pas
          comptée.
        </p>
      </section>

      <section className="card">
        <h2>2. L'accord sur une question</h2>
        <p>
          Pour chaque question, l'accord vaut <code>1 − |vous − candidat·e| / 4</code> : 100 % si les positions sont identiques, 0 % si elles sont
          aux deux extrêmes, 50 % pour un écart de deux crans. Une position inconnue est exclue du calcul : elle n'est jamais devinée ni remplacée par
          une valeur neutre.
        </p>
      </section>

      <section className="card">
        <h2>3. L'affinité avec un·e candidat·e</h2>
        <p>
          L'affinité est la moyenne des accords, pondérée par l'importance que vous donnez à chaque question (poids {o.importantWeight} pour une
          question marquée « compte beaucoup pour moi », 1 sinon). Le classement trie les candidat·es par affinité décroissante ; en cas d'égalité, par
          ordre alphabétique.
        </p>
        <ul>
          <li>Un classement n'est produit qu'à partir de {o.minAnswered} réponses.</li>
          <li>
            Un·e candidat·e doit avoir une position connue sur au moins {Math.round(o.minCoverage * 100)} % des questions auxquelles vous avez répondu ;
            sinon, l'affinité est indiquée mais la personne n'est pas classée.
          </li>
          <li>Seules les candidatures déclarées, désignées ou engagées dans une primaire sont classées ; les candidatures pressenties sont listées à part.</li>
          <li>Le statut de vérification d'une source ne modifie jamais l'affinité : il n'intervient que dans l'indice de confiance.</li>
        </ul>
      </section>

      <section className="card">
        <h2>4. L'indice de confiance</h2>
        <p>Il mesure à quel point la suggestion en tête est solide. C'est une somme pondérée de quatre composantes, chacune entre 0 et 1 :</p>
        <ul>
          <li>
            <strong>Réponses</strong> (poids {CONFIDENCE_WEIGHTS.answers}) : nombre de réponses ÷ {o.fullConfidenceAnswers}, plafonné à 1.
          </li>
          <li>
            <strong>Couverture</strong> (poids {CONFIDENCE_WEIGHTS.coverage}) : part de vos réponses pour lesquelles la position du ou de la candidat·e en
            tête est connue.
          </li>
          <li>
            <strong>Vérification</strong> (poids {CONFIDENCE_WEIGHTS.verified}) : 0,6 + 0,4 × part des positions utilisées relues par deux personnes.
          </li>
          <li>
            <strong>Écart</strong> (poids {CONFIDENCE_WEIGHTS.margin}) : (affinité du 1er − affinité du 2e) ÷ {o.marginForFullConfidence}, plafonné à 1. Deux
            candidat·es à égalité donnent 0.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>5. D'où viennent les positions</h2>
        <p>
          Chaque position provient d'une <em>déclaration</em> : un document officiel daté du ou de la candidat·e ou de son parti (programme, page de
          propositions, discours ou communiqué publiés par eux, vote). Un article de presse ne peut pas fonder une position. Chaque position porte la
          citation textuelle du passage qui la fonde ; quand la source traite d'une mesure voisine, la position est signalée « déduite ». Quand plusieurs
          déclarations portent sur la même question, la plus récente l'emporte. Les positions ne sont jamais saisies directement : modifier une
          position, c'est ajouter ou corriger une déclaration, publiquement, dans le dépôt.
        </p>
        <p>
          Version du jeu de données : <code>{dataset.version}</code> (empreinte SHA-256 des fichiers de données). Elle change dès qu'une virgule change.
        </p>
      </section>

      <section className="card">
        <h2>6. Limites connues</h2>
        <ul>
          <li>Une échelle en cinq points simplifie des positions parfois nuancées ou conditionnelles ; la note attachée à chaque position précise la mesure.</li>
          <li>Les questions ne couvrent pas tout et leur formulation influence les réponses ; leur rédaction suit une charte publique.</li>
          <li>Les candidat·es documenté·es avec peu de positions sont défavorisé·es dans la couverture, pas dans l'affinité.</li>
          <li>Un résultat n'est pas une recommandation de vote : c'est une mesure de proximité sur les questions posées.</li>
        </ul>
        <p>
          <a href={`${REPO_URL}/blob/main/docs/METHODOLOGIE.md`} rel="noopener noreferrer">
            Version détaillée de la méthode
          </a>{' '}
          · <Link to="/transparence">Transparence et vérification</Link>
        </p>
      </section>
    </>
  );
}
