# Transparence et vérifiabilité

L'engagement « aucune déformation » repose sur des mécanismes vérifiables, pas sur la confiance.

## 1. Chaque position a une provenance

Aucune position n'est saisie directement. Elle est dérivée d'une déclaration (`data/declarations/`) qui porte : une date, une URL, un type de source, un résumé, un statut de relecture. L'interface affiche cette provenance sur chaque position (page candidat, comparaison question par question).

## 2. Le calcul est public et testé

`src/lib/matching.ts` est un module pur, sans dépendance, couvert par `tests/matching.test.ts`. Sa description en français (`docs/METHODOLOGIE.md`, page `/methodologie`) lit ses paramètres directement dans le code.

## 3. Ce qui est servi est ce qui est publié

- Le pied de page affiche la révision git déployée et l'empreinte du jeu de données.
- Le jeu de données complet est servi tel quel : `data/dataset.json`, `data/VERSION`.
- Pour vérifier : `git checkout <révision> && npm ci && npm run data:build && cat public/data/VERSION`. L'empreinte doit être identique à celle affichée.
- Le déploiement est fait par une action GitHub publique (`.github/workflows/deploy-pages.yml`) : on peut relire les journaux de construction.

## 4. Les changements sont tracés

Chaque modification de données passe par une pull request publique, validée automatiquement (schéma, sources, cohérence) et relue par une seconde personne avant d'être marquée vérifiée. L'historique git est l'audit trail.

## 5. Le processus de mise à jour est le même pour tout le monde

La checklist hebdomadaire liste tous les candidat·es et mesure leur couverture. Une couverture inégale est visible (page `/candidats`) et n'est jamais compensée par des positions devinées.

## 6. Comment contester

- Une position : issue « Déclaration » avec la source qui la contredit ; en attendant l'arbitrage, la déclaration passe en `disputed` et l'interface l'indique.
- Une question : issue « Question » en s'appuyant sur la charte éditoriale.
- La méthode : issue libre ; toute modification des paramètres de calcul se fait par pull request, avec mise à jour de `docs/METHODOLOGIE.md` et des tests.

## 7. Licences

Code : GNU AGPL v3 — toute version modifiée mise en ligne doit publier son code. Données : CC BY 4.0. Cela garantit qu'une copie ne peut pas modifier discrètement les positions ou le calcul.
