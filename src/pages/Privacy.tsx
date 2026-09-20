import { useState } from 'react';
import { Link } from 'react-router-dom';
import { feedbackEndpoint } from '../lib/feedback';
import { OPERATOR_CONTACT, OPERATOR_NAME, REPO_URL } from '../lib/format';
import { exportState, loadState } from '../lib/storage';
import { useAppState } from '../state/AppState';

export default function Privacy() {
  const { mode, setMode, reset, results } = useAppState();
  const [erased, setErased] = useState(false);
  const endpoint = feedbackEndpoint();
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="lead">Résumé : rien ne quitte votre appareil. Le détail ci-dessous vaut politique de confidentialité au sens du RGPD.</p>

      <section className="card">
        <h2>Vos réglages, tout de suite</h2>
        <fieldset className="mode-choice">
          <legend>Conservation de vos réponses sur cet appareil</legend>
          <label>
            <input type="radio" name="mode" checked={mode === 'local'} onChange={() => setMode('local')} />
            Conserver (stockage local du navigateur) pour reprendre plus tard
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'session'} onChange={() => setMode('session')} />
            Ne pas conserver : effacement à la fermeture de l'onglet
          </label>
        </fieldset>
        <div className="cta-row">
          <button
            className="button"
            onClick={() => {
              const blob = new Blob([exportState(loadState())], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'boussole-2027-mes-donnees.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exporter mes données
          </button>
          <button
            className="button danger"
            onClick={() => {
              if (window.confirm('Effacer toutes vos données de cet appareil ?')) {
                reset();
                setErased(true);
              }
            }}
          >
            Effacer toutes mes données ({results.answered} réponses)
          </button>
        </div>
        {erased && <p className="ok">Vos données ont été effacées de cet appareil.</p>}
      </section>

      <section className="card">
        <h2>Responsable de traitement</h2>
        <p>
          {OPERATOR_NAME} — contact : {OPERATOR_CONTACT}. Le code source de cet outil est public ({' '}
          <a href={REPO_URL} rel="noopener noreferrer">
            dépôt
          </a>
          ) : chacun peut vérifier que ce qui est décrit ici correspond à ce qui est exécuté.
        </p>
      </section>

      <section className="card">
        <h2>Quelles données, pour quoi, sur quelle base</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Donnée</th>
              <th scope="col">Où elle est traitée</th>
              <th scope="col">Finalité</th>
              <th scope="col">Base légale</th>
              <th scope="col">Durée</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vos réponses au questionnaire et vos pondérations (opinions politiques : donnée sensible, art. 9 RGPD)</td>
              <td>Uniquement dans votre navigateur (mémoire de l'onglet ou stockage local selon votre choix). Jamais transmises.</td>
              <td>Calculer l'affinité avec les candidat·es, vous permettre de reprendre le questionnaire.</td>
              <td>Aucun traitement par le responsable : les données restent sous votre contrôle exclusif (art. 2.2.c RGPD, usage personnel).</td>
              <td>Jusqu'à effacement par vous, ou fermeture de l'onglet en mode « ne pas conserver ».</td>
            </tr>
            <tr>
              <td>Votre avis sur le résultat (d'accord / en partie / non, candidat·e attendu·e)</td>
              <td>Dans votre navigateur.</td>
              <td>Vous permettre de le retrouver.</td>
              <td>Idem.</td>
              <td>Idem.</td>
            </tr>
            <tr>
              <td>Avis anonyme envoyé (facultatif)</td>
              <td>
                {endpoint ? (
                  <>
                    Serveur de collecte configuré : <code>{endpoint}</code>.
                  </>
                ) : (
                  'Aucun serveur de collecte n’est configuré sur cette instance : rien ne peut être envoyé.'
                )}
              </td>
              <td>Mesurer la qualité des suggestions, en agrégé.</td>
              <td>Consentement explicite (case à cocher), retirable en n'envoyant pas.</td>
              <td>Compteurs agrégés par jour, sans donnée individuelle.</td>
            </tr>
            <tr>
              <td>Journaux techniques de l'hébergeur (adresse IP, page demandée)</td>
              <td>Chez l'hébergeur du site statique.</td>
              <td>Sécurité et fonctionnement du service.</td>
              <td>Intérêt légitime.</td>
              <td>Selon l'hébergeur ; à renseigner dans les mentions légales.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Ce qui est envoyé en cas d'avis anonyme, et rien d'autre : candidat·e suggéré·e, votre avis, la personne attendue le cas échéant, l'affinité
          et l'indice de confiance arrondis à la dizaine, une tranche de nombre de réponses, la version des données. Le serveur de référence fourni
          dans le dépôt n'enregistre ni adresse IP, ni agent utilisateur, ni horodatage plus fin que le jour.
        </p>
      </section>

      <section className="card">
        <h2>Ce que nous n'utilisons pas</h2>
        <ul>
          <li>Aucun cookie, aucun traceur, aucune mesure d'audience, aucun bouton de partage embarqué.</li>
          <li>Aucune ressource tierce (polices, scripts, images) : une politique de sécurité du contenu (CSP) l'interdit techniquement.</li>
          <li>Aucun compte utilisateur, aucune adresse e-mail.</li>
          <li>Aucun transfert hors de l'Union européenne par l'application elle-même.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Vos droits</h2>
        <p>
          Accès, rectification, portabilité et effacement s'exercent directement ci-dessus, sans nous demander : nous ne détenons pas vos données.
          Pour toute question, ou pour saisir l'autorité de contrôle (CNIL, <a href="https://www.cnil.fr">cnil.fr</a>), contactez {OPERATOR_CONTACT}.
        </p>
        <p>
          <Link to="/mentions-legales">Mentions légales</Link> · <Link to="/transparence">Transparence</Link>
        </p>
      </section>
    </>
  );
}
