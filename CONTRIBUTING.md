# Contribuer

Merci de vouloir améliorer la boussole. Trois façons de contribuer, par ordre d'utilité :

1. **Documenter une prise de position** (le plus précieux) — issue « Déclaration » ou pull request sur `data/declarations/<candidat>.json`. Lisez d'abord [docs/CHARTE-EDITORIALE.md](docs/CHARTE-EDITORIALE.md) et [docs/MISES-A-JOUR.md](docs/MISES-A-JOUR.md).
2. **Relire** une déclaration en attente : ouvrez la source, vérifiez l'encodage, puis passez `review.status` à `verified` en ajoutant votre nom aux `reviewers` (deux noms minimum, dont un qui n'est pas l'auteur·rice).
3. **Améliorer le code ou les questions** — issue « Question » pour une formulation, pull request pour le reste.

## Mise en route

```bash
git clone https://github.com/FlyingfrogFR/French-Election-Mapper.git
cd French-Election-Mapper
npm ci
npm run dev        # http://localhost:5173, le jeu de données est généré automatiquement
npm run check      # tout ce que la CI vérifie

npm run data:check-quotes                      # vérifie que chaque citation figure bien dans la source citée
npm run data:check-quotes -- --candidate=faure # sur un seul candidat
```

`data:check-quotes` télécharge chaque source citée (page ou PDF), la normalise et cherche la citation.
Elle signale `MISSING` si la citation est introuvable — il faut alors corriger la citation ou retirer la
position — et `NOFETCH` si la source n'a pas pu être téléchargée (certains éditeurs bloquent les robots :
récupérez la page dans un navigateur et déposez son texte dans le cache indiqué par `QUOTES_CACHE`).

## Règles non négociables

- Pas de position sans **document officiel** du ou de la candidat·e ou de son parti (jamais un article de presse ni un comparateur tiers).
- Pas de position sans **citation textuelle** (`quote`) du passage qui la fonde, ni sans l'URL exacte de la page.
- Pas de modification du moteur de calcul sans mise à jour de `docs/METHODOLOGIE.md` et des tests.
- Pas de dépendance à un service tiers dans l'application (police, script, image, mesure d'audience).
- Pas de couleur ou de traitement différencié par candidat·e ou par parti.

## Style

TypeScript strict, composants fonctionnels, pas de bibliothèque d'état. Le français est la langue de l'interface, des données et de la documentation ; le code et les identifiants sont en anglais.

## Code de conduite

Les débats portent sur les sources et les formulations, jamais sur les personnes. Les contributions militantes sont bienvenues tant qu'elles respectent la charte ; l'objectif commun est que chaque candidat·e se reconnaisse dans les positions affichées.
