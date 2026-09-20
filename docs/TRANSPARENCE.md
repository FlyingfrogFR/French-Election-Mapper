# Transparence et vérifiabilité

L'engagement « aucune déformation » repose sur des mécanismes vérifiables, pas sur la confiance.

## 1. Chaque position a une provenance

Aucune position n'est saisie directement. Elle est dérivée d'une déclaration (`data/declarations/`) adossée à un document officiel du ou de la candidat·e ou de son parti, qui porte : une date, une URL, un type de source, un résumé, un statut de relecture — et, pour chaque position, la citation textuelle du passage qui la fonde. L'interface affiche cette provenance et cette citation sur chaque position (page candidat, comparaison question par question). Un article de presse ne peut pas fonder une position : la validation automatique le refuse.

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

## 7. Audit des programmes officiels (septembre 2026)

Le jeu de données initial avait été encodé à partir de sources mêlant programmes, votes et articles
de presse. Il est repris candidat·e par candidat·e contre les **documents officiels** uniquement, avec
pour chaque position la citation textuelle du passage qui la fonde. La reprise a déjà :

- remplacé des positions issues de synthèses de presse par des citations de programmes officiels ;
- **supprimé** les positions qu'aucun document officiel n'étaye (une position absente est préférable à
  une position devinée) ;
- **corrigé** des positions erronées, par exemple : le projet de Debout la France propose désormais
  explicitement la sortie de l'Union européenne et fixe l'objectif de défense à 2,5 % du PIB (et non
  3 %) ; « L'Avenir en commun » instaure une conscription citoyenne obligatoire de neuf mois ;
  le pacte constitutionnel des Républicains abaisse le seuil du référendum d'initiative partagée ;
  « Acte un » de Place publique propose une assemblée constituante ;
- **écarté** les déclarations d'autres responsables d'un parti : seule la parole du ou de la
  candidat·e engage sa position.

Les citations sont vérifiées automatiquement, et vous pouvez refaire cette vérification vous-même :

```bash
npm run data:check-quotes                        # toutes les positions
npm run data:check-quotes -- --candidate=melenchon
```

Le script télécharge chaque source citée (page web ou PDF), la normalise et cherche la citation.
Il échoue si une citation est introuvable dans la source. Une source peut être signalée « injoignable »
lorsque son éditeur bloque les téléchargements automatisés : cela ne veut pas dire que la citation est
fausse, mais que la vérification doit être refaite à la main.

## 8. Licences

Code : GNU AGPL v3 — toute version modifiée mise en ligne doit publier son code. Données : CC BY 4.0. Cela garantit qu'une copie ne peut pas modifier discrètement les positions ou le calcul.
