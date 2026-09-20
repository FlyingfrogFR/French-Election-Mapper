import { OPERATOR_CONTACT, OPERATOR_NAME, REPO_URL } from '../lib/format';

export default function Legal() {
  return (
    <>
      <h1>Mentions légales</h1>
      <section className="card">
        <h2>Éditeur</h2>
        <p>
          {OPERATOR_NAME} — {OPERATOR_CONTACT}.
        </p>
        <p className="hint">
          Les valeurs entre crochets sont à renseigner par l'exploitant du site via les variables <code>VITE_OPERATOR_NAME</code> et{' '}
          <code>VITE_OPERATOR_CONTACT</code> au moment de la construction du site (voir <code>docs/DEPLOIEMENT.md</code>).
        </p>
      </section>
      <section className="card">
        <h2>Hébergement</h2>
        <p>[Nom et adresse de l'hébergeur à renseigner.]</p>
      </section>
      <section className="card">
        <h2>Licence et réutilisation</h2>
        <p>
          Le code source est publié sous licence GNU AGPL v3 ; les données (questions, déclarations) sous licence Creative Commons BY 4.0. Vous pouvez
          les réutiliser en citant la source :{' '}
          <a href={REPO_URL} rel="noopener noreferrer">
            {REPO_URL}
          </a>
          .
        </p>
      </section>
      <section className="card">
        <h2>Indépendance</h2>
        <p>
          Cet outil n'est affilié à aucun parti ni candidat·e. Il ne recommande aucun vote : il mesure une proximité sur les questions posées, selon
          une méthode publique. Les erreurs de saisie sont possibles et corrigées publiquement dès qu'elles sont signalées.
        </p>
      </section>
    </>
  );
}
