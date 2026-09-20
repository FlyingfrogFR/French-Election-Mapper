# Méthode de calcul

Ce document décrit exactement ce que fait `src/lib/matching.ts`. Les tests de `tests/matching.test.ts` vérifient chaque règle. Si le code et ce document divergent, c'est un bug : ouvrez une issue.

## 1. Échelle commune

| Valeur | Pour la personne qui répond | Pour un·e candidat·e |
|---|---|---|
| −2 | Pas du tout d'accord | Fortement contre |
| −1 | Plutôt pas d'accord | Plutôt contre |
| 0 | Partagé·e / neutre | Position mitigée, conditionnelle ou neutre |
| +1 | Plutôt d'accord | Plutôt pour |
| +2 | Tout à fait d'accord | Fortement pour |

Une question **passée** n'entre pas dans le calcul. Une question peut être marquée « compte beaucoup pour moi » : son poids passe de 1 à 2 (`importantWeight`).

## 2. Accord sur une question

```
accord(q) = 1 − |réponse(q) − position_candidat(q)| / 4
```

Identique → 1 ; extrêmes opposés → 0 ; deux crans d'écart → 0,5. Si la position du ou de la candidat·e est **inconnue**, la question est exclue pour ce·tte candidat·e : aucune valeur par défaut n'est jamais substituée.

## 3. Affinité avec un·e candidat·e

```
affinité = Σ poids(q) × accord(q) / Σ poids(q)      (sur les questions répondues à position connue)
couverture = nombre de questions répondues à position connue / nombre de questions répondues
```

Règles de classement (`DEFAULT_OPTIONS`) :

| Paramètre | Valeur | Effet |
|---|---|---|
| `minAnswered` | 10 | En dessous, aucun classement n'est produit. |
| `minCoverage` | 0,5 | En dessous, le ou la candidat·e est affiché·e « non classé·e » avec son affinité indicative. |
| `includeStatuses` | déclaré, désigné, primaire | Les candidatures pressenties ne sont jamais classées. |
| égalités | — | Ordre alphabétique du nom de famille (jamais l'ordre du fichier). |

Le statut de relecture d'une source (`pending` / `verified`) **ne modifie pas** l'affinité. Le pondérer avantagerait mécaniquement les candidat·es les mieux documenté·es.

Un score par thème est calculé avec la même formule, restreinte aux questions du thème.

## 4. Indice de confiance

Il qualifie la robustesse de la suggestion en tête, entre 0 et 100 :

```
confiance = 0,30 × réponses + 0,25 × couverture + 0,15 × vérification + 0,30 × écart
```

| Composante | Définition |
|---|---|
| réponses | min(1, nombre de réponses / 40) |
| couverture | couverture du ou de la candidat·e en tête |
| vérification | 0,6 + 0,4 × part des positions utilisées relues par deux personnes |
| écart | min(1, (affinité 1er − affinité 2e) / 0,10) ; 0 en cas d'égalité |

Interprétation : un indice faible signifie que le résultat pourrait basculer avec quelques réponses de plus, ou que le ou la candidat·e en tête est peu documenté·e — pas que le calcul est faux.

## 5. Provenance des positions

Les positions sont **dérivées** au moment de la construction du site (`scripts/lib/derive.ts`) à partir de `data/declarations/*.json` :

1. chaque déclaration est datée, sourcée et liste les questions qu'elle renseigne ;
2. pour chaque candidat·e et chaque question, la déclaration la plus récente l'emporte ;
3. la provenance (identifiant, date, URL, statut de relecture) est conservée avec la position et affichée dans l'interface.

Le jeu de données porte une empreinte SHA-256 (12 caractères) calculée sur le JSON canonique de `data/`. Elle est affichée en pied de page et publiée dans `data/VERSION`.

## 6. Ce que la méthode ne fait pas

- Pas de pondération par sondage, notoriété ou « vote utile ».
- Pas d'inférence : une position non documentée reste inconnue, même si le parti a une position connue.
- Pas de personnalisation cachée : deux personnes qui répondent la même chose obtiennent le même résultat, quel que soit l'appareil.
- Pas d'aléa : le calcul est entièrement déterministe.

## 7. Limites

- Une échelle en cinq points aplatit des positions conditionnelles ; la note attachée à chaque position documente la nuance.
- Le choix et la formulation des questions influencent le résultat ; ils suivent la [charte éditoriale](CHARTE-EDITORIALE.md) et sont discutables publiquement.
- La couverture inégale entre candidat·es est une propriété des données, visible et mesurée, pas corrigée artificiellement.
