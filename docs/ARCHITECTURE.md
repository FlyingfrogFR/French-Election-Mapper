# Architecture

```
data/                     Source de vérité, éditée par pull request
  topics.json             15 thèmes
  questions.json          163 affirmations (id stable, thème, énoncé, contexte)
  candidates.json         Élection, primaires, candidat·es avec statut et sources
  declarations/<id>.json  Déclarations datées et sourcées → positions
scripts/
  lib/load.ts             Lecture + validation (zod) + règles de cohérence inter-fichiers
  lib/derive.ts           Dérivation des positions (la plus récente l'emporte), empreinte SHA-256
  validate-data.ts        `npm run data:validate`
  build-dataset.ts        `npm run data:build` → src/generated/dataset.json, public/data/{dataset.json,VERSION,updates.xml}
  freshness.ts            Rapport de fraîcheur (table / json / markdown)
src/
  lib/schema.ts           Types et schémas partagés scripts ↔ application
  lib/matching.ts         Moteur de calcul (pur, testé)
  lib/storage.ts          Persistance locale, export, effacement
  lib/feedback.ts         Charge utile anonyme et envoi opt-in
  state/AppState.tsx      État React (réponses, avis, mode de stockage)
  pages/                  Accueil, Questionnaire, Résultats, Candidats, Mises à jour, Méthode, Confidentialité, Mentions, Transparence
tests/                    vitest : moteur, dérivation, invariants du jeu de données, charge utile
server/                   Serveur de retours anonymes de référence (sans dépendance) + tests node:test
.github/workflows/        CI, checklist hebdomadaire, déploiement Pages
docs/                     Méthode, charte, RGPD, transparence, mises à jour, déploiement
```

Flux : `data/` → validation → dérivation → `dataset.json` (empreinte) → application statique → navigateur (calcul local).

Choix structurants :

- **Site statique, calcul client** : supprime le traitement de données sensibles côté serveur.
- **Déclarations plutôt que positions** : chaque valeur est traçable et datée ; le changement d'avis est un ajout, pas une réécriture.
- **Empreinte du jeu de données** : lie ce qui est affiché à un état précis du dépôt.
- **Dépendances minimales** : React, React Router, zod ; aucun service externe.
