# Processus de mise à jour (hebdomadaire au minimum)

## Rythme

- **Chaque lundi 07:00 UTC**, l'action `weekly-update.yml` ouvre une issue « Mise à jour hebdomadaire — semaine AAAA-Sxx » avec, pour chaque candidat·e, la date de sa dernière déclaration, sa couverture et le nombre de positions en attente. Les candidat·es sans mise à jour depuis 7 jours sont marqué·es ⚠️.
- **À tout moment**, une déclaration importante (annonce, vote, retournement) peut être ajoutée par pull request ; l'action est aussi déclenchable à la main (`workflow_dispatch`).
- **Chaque fusion sur `main`** regénère le jeu de données (nouvelle empreinte) et redéploie le site. Le journal public (`/mises-a-jour`) et le flux RSS (`data/updates.xml`) reflètent immédiatement le changement.

## Veille automatisée

Chaque semaine, après l'ouverture de la checklist, une session Claude (Claude Code, d'Anthropic) exécute la veille décrite dans [`.claude/workflows/veille-hebdo.js`](../.claude/workflows/veille-hebdo.js). Ce fichier contient **les instructions exactes données aux agents** ; il est public pour que chacun puisse vérifier qu'elles ne favorisent personne.

1. **Recherche**, un agent par candidat·e : publications officielles de la période (site de campagne, site du parti, discours et communiqués publiés, tribunes signées, propositions de loi, votes). La presse sert seulement à repérer un document ; elle ne fonde jamais une position. Chaque citation est copiée depuis `npm run data:source`, le lecteur qu'utilise le contrôle des citations, et vérifiée avant d'être proposée.
2. **Deux relectures adverses et indépendantes** de chaque proposition : *fidélité* (la citation exprime-t-elle cette position, avec cette force, sur cette affirmation ?) et *provenance* (document officiel, date, citation présente mot pour mot). Une position n'est retenue que si les deux l'acceptent. Une relecture peut seulement affaiblir une valeur (de ±2 à ±1), jamais la renforcer ni en changer le signe.
3. **Statuts** : candidatures nouvelles ou retirées, primaires. Il faut deux sources fiables indépendantes ou une source officielle, puis une relecture adverse.
4. **Complétude** : un dernier agent cherche ce qui a été manqué ; ses pistes repassent par la recherche et les deux relectures.
5. **Intégration déterministe** : `npm run data:apply-veille -- <résultat.json>` applique le résultat (schéma vérifié, doublons écartés), puis `npm run check` et `npm run data:check-quotes`.
6. **Pull request** portant le rapport : déclarations ajoutées, positions qui changent, éléments écartés et pourquoi, candidat·es sans nouvelle publication.

La veille ne fusionne rien, ne marque rien « vérifié » et ne supprime aucune déclaration (un changement d'avis s'ajoute, il n'efface pas). **Rien n'est publié sans qu'une personne fusionne la pull request**, et chaque déclaration ajoutée reste « en attente de vérification » jusqu'à la relecture d'une seconde personne.

Le déclenchement hebdomadaire est planifié dans le compte Claude de l'opérateur·rice du site, donc hors du dépôt. Chaque exécution, elle, y laisse une trace complète : la pull request, son rapport et l'historique git.

Pour travailler à la main avec les mêmes outils :

- `npm run data:brief -- <candidat>` : statut, déclarations déjà enregistrées, position actuelle sur chaque affirmation ;
- `npm run data:source -- <url>` : texte d'une page ou d'un PDF tel que le contrôle des citations le lira ; `--quote="…"` vérifie une citation, `--grep="…"` montre les passages autour d'un mot, `--links` liste les liens de la page.

## Ajouter une déclaration

1. Ouvrir `data/declarations/<candidat>.json`.
2. Ajouter un objet dans `declarations` :

```json
{
  "id": "tondelier-2026-10-primaire",
  "date": "2026-10-11",
  "title": "Discours après la primaire de la gauche unitaire",
  "sourceType": "discours",
  "sourceUrl": "https://…",
  "publisher": "Les Écologistes",
  "summary": "Résumé fidèle en une ou deux phrases.",
  "quote": "Citation exacte, facultative.",
  "review": { "status": "pending", "reviewers": [], "reviewedOn": null },
  "positions": [
    {
      "questionId": "env-02",
      "value": 2,
      "quote": "Nous organiserons la sortie progressive du nucléaire d'ici 2045.",
      "sourceUrl": "https://…/programme/energie",
      "note": "Sortie du nucléaire en 2045."
    }
  ]
}
```

3. `npm run data:validate` puis `npm run data:build` : l'empreinte change. La validation refuse une position sans `quote`, et toute position adossée à un article de presse (`sourceType: "presse"`) : seuls les documents officiels du ou de la candidat·e ou de son parti fondent une position.
4. Ouvrir une pull request avec le gabarit ; cocher les cases.
5. Une seconde personne relit la source et, si l'encodage est fidèle, passe `review` à `{"status":"verified","reviewers":["auteur","relecteur"],"reviewedOn":"AAAA-MM-JJ"}`.

## Ajouter ou retirer un·e candidat·e

Modifier `data/candidates.json` (statut, date, `statusNote`, `sources`) et créer le fichier `data/declarations/<id>.json` (éventuellement vide : `{"candidateId":"…","declarations":[]}`). Un retrait se note par `status: "withdrawn"` avec sa source : la personne reste dans l'historique mais n'est plus classée.

## Fraîcheur affichée

L'interface affiche la date de la dernière déclaration et avertit si elle date de plus de 7 jours. `npm run data:freshness` donne le même rapport en ligne de commande (`--json` pour l'exploiter ailleurs).
