# Boussole présidentielle 2027

Boussole électorale **libre, sourcée et sans traceur** pour l'élection présidentielle française des 18 avril et 2 mai 2027.

Vous répondez à 163 affirmations réparties en 15 thèmes ; la boussole vous indique le ou la candidat·e dont les positions documentées sont les plus proches des vôtres, avec un indice de confiance, le détail par thème et question par question, chaque position renvoyant à sa source. Vous dites ensuite si le résultat vous paraît juste.

**Rien ne quitte votre appareil** : le site est statique, le calcul se fait dans le navigateur, il n'y a ni compte, ni cookie, ni ressource tierce.

## Pourquoi ce dépôt est public

Pour qu'on puisse vérifier qu'aucune position n'est déformée :

- chaque position provient d'une **déclaration datée et sourcée** (`data/declarations/`), jamais d'une saisie directe ; la plus récente l'emporte ;
- le **calcul** tient dans un module pur et testé (`src/lib/matching.ts`), décrit pas à pas dans [docs/METHODOLOGIE.md](docs/METHODOLOGIE.md) ;
- le site affiche la **révision git** et l'**empreinte SHA-256 du jeu de données** ; n'importe qui peut reconstruire et comparer ([docs/TRANSPARENCE.md](docs/TRANSPARENCE.md)) ;
- toute modification passe par une pull request validée automatiquement et **relue par une seconde personne** ;
- licence **AGPL v3** pour le code, **CC BY 4.0** pour les données : une copie modifiée doit publier ses modifications.

## Mises à jour hebdomadaires

Chaque lundi, une action GitHub ouvre une checklist listant tous les candidat·es, leur couverture et leur dernière déclaration. Une **veille automatisée** passe ensuite en revue les publications officielles de chacun·e et propose les ajouts par pull request, après deux relectures adverses indépendantes ; **rien n'est publié sans qu'une personne fusionne la pull request**. Les instructions exactes données à cette veille sont publiques : [`.claude/workflows/veille-hebdo.js`](.claude/workflows/veille-hebdo.js) ([docs/MISES-A-JOUR.md](docs/MISES-A-JOUR.md)).

Chaque fusion redéploie le site, met à jour le journal public `/mises-a-jour` et le flux RSS `data/updates.xml`.

## RGPD

Conçu pour ne pas traiter de données : réponses stockées uniquement dans le navigateur (au choix : conservées ou effacées à la fermeture), export et effacement en un clic, politique de confidentialité complète dans l'application, registre et analyse dans [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md). L'unique collecte possible, un retour anonyme facultatif, exige un consentement explicite et n'envoie que des tranches agrégées ([server/README.md](server/README.md)).

## Démarrer

```bash
npm ci
npm run dev       # développement, http://localhost:5173
npm run check     # validation des données, types, tests, serveur
npm run build     # site statique dans dist/
```

Scripts de données : `npm run data:validate`, `npm run data:build`, `npm run data:freshness -- --markdown`, `npm run data:check-quotes`, et pour préparer une déclaration `npm run data:brief -- <candidat>`, `npm run data:source -- <url>` et `npm run data:search -- "<requête>"`.

## État des données

Les positions sont **réencodées à partir des programmes officiels** des candidat·es : programme ou
projet publié par la personne ou par son parti, page de propositions du site de campagne, discours,
communiqué ou tribune publiés par eux, vote enregistré. Un article de presse ou un comparateur tiers
ne peut pas fonder une position ; il sert uniquement à localiser le document officiel.

Chaque position porte, dans les données comme dans l'interface, **la citation textuelle du passage
qui la fonde** et l'URL exacte de la page (ou de la page du PDF). Quand le document traite d'une
mesure voisine et que la position s'en déduit sans ambiguïté, elle est signalée « position déduite »
et accompagnée d'une note ; dans le doute, rien n'est encodé.

L'audit est terminé : les 21 candidat·es dont des positions sont documentées ont été
réencodé·es à partir de leurs documents officiels, et **chacune des 1553 positions
porte la citation du passage qui la fonde**. Plus aucune position ne repose sur un article de presse ;
la validation automatique le refuse désormais.

Toutes les positions sont en statut **« en attente de vérification »** : elles doivent encore être
relues par une seconde personne avant d'être marquées vérifiées.

La couverture est très inégale d'un·e candidat·e à l'autre, parce que les programmes publiés le sont :
certain·es ont publié un projet complet, d'autres seulement quelques pages de propositions ou des
tribunes. Cette couverture est affichée et mesurée, jamais comblée par des positions devinées ; une
candidature trop peu documentée n'est pas classée, et la boussole le dit plutôt que de lui prêter des
positions qu'elle n'a pas prises.

## Documentation

- [Méthode de calcul](docs/METHODOLOGIE.md) · [Charte éditoriale](docs/CHARTE-EDITORIALE.md) · [Mises à jour](docs/MISES-A-JOUR.md)
- [RGPD](docs/CONFIDENTIALITE.md) · [Transparence](docs/TRANSPARENCE.md) · [Déploiement](docs/DEPLOIEMENT.md) · [Architecture](docs/ARCHITECTURE.md)
- [Contribuer](CONTRIBUTING.md) · [Sécurité](SECURITY.md)

## Licences

Code : [GNU AGPL v3](LICENSE). Données : [CC BY 4.0](data/LICENSE). Cet outil n'est affilié à aucun parti ni candidat·e et ne recommande aucun vote.
