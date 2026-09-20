# Processus de mise à jour (hebdomadaire au minimum)

## Rythme

- **Chaque lundi 07:00 UTC**, l'action `weekly-update.yml` ouvre une issue « Mise à jour hebdomadaire — semaine AAAA-Sxx » avec, pour chaque candidat·e, la date de sa dernière déclaration, sa couverture et le nombre de positions en attente. Les candidat·es sans mise à jour depuis 7 jours sont marqué·es ⚠️.
- **À tout moment**, une déclaration importante (annonce, vote, retournement) peut être ajoutée par pull request ; l'action est aussi déclenchable à la main (`workflow_dispatch`).
- **Chaque fusion sur `main`** regénère le jeu de données (nouvelle empreinte) et redéploie le site. Le journal public (`/mises-a-jour`) et le flux RSS (`data/updates.xml`) reflètent immédiatement le changement.

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
    { "questionId": "env-02", "value": 2, "note": "Sortie du nucléaire en 2045." }
  ]
}
```

3. `npm run data:validate` puis `npm run data:build` : l'empreinte change.
4. Ouvrir une pull request avec le gabarit ; cocher les cases.
5. Une seconde personne relit la source et, si l'encodage est fidèle, passe `review` à `{"status":"verified","reviewers":["auteur","relecteur"],"reviewedOn":"AAAA-MM-JJ"}`.

## Ajouter ou retirer un·e candidat·e

Modifier `data/candidates.json` (statut, date, `statusNote`, `sources`) et créer le fichier `data/declarations/<id>.json` (éventuellement vide : `{"candidateId":"…","declarations":[]}`). Un retrait se note par `status: "withdrawn"` avec sa source : la personne reste dans l'historique mais n'est plus classée.

## Fraîcheur affichée

L'interface affiche la date de la dernière déclaration et avertit si elle date de plus de 7 jours. `npm run data:freshness` donne le même rapport en ligne de commande (`--json` pour l'exploiter ailleurs).
