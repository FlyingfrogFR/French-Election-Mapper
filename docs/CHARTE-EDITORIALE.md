# Charte éditoriale

## Questions

1. **Une affirmation, une idée.** Chaque question est une phrase affirmative à laquelle on répond de « pas du tout d'accord » à « tout à fait d'accord ». Pas de double négation, pas de « et » qui mélange deux mesures.
2. **Vocabulaire neutre.** On décrit la mesure, pas son intention supposée. « Réduire l'immigration légale avec des quotas votés par le Parlement » plutôt que « stopper l'invasion » ou « fermer les frontières » ; « impôt plancher de 2 % sur les patrimoines supérieurs à 100 M€ » plutôt que « faire payer les riches ».
3. **Discriminante.** Une question sur laquelle tou·tes les candidat·es sont d'accord n'aide pas à les distinguer ; elle est retirée ou reformulée.
4. **Contexte factuel.** Le champ `context` donne un repère chiffré ou juridique vérifiable, sans argument pour ou contre.
5. **Équilibre des orientations.** Dans chaque thème, on veille à ce qu'être « d'accord » ne corresponde pas systématiquement au même bord politique.
6. **Actualité.** Une mesure déjà adoptée n'est plus une question, sauf si son abrogation est en débat (alors la question porte sur l'abrogation).
7. **Stabilité des identifiants.** Un identifiant (`tra-01`) n'est jamais réutilisé pour un autre sujet. Reformuler une question qui change de sens impose de réencoder les positions existantes.

## Positions des candidat·es

1. **La personne, pas le parti.** La source doit montrer le ou la candidat·e prenant position (programme signé, discours, vote, entretien, tribune). Une position de parti n'est utilisée que si la personne en est la candidate désignée et ne s'en est pas démarquée ; cela se note dans `note`.
2. **La plus récente l'emporte.** Un changement d'avis est un fait : on ajoute une déclaration plus récente, on ne supprime jamais l'ancienne.
3. **Encodage prudent.** +2 / −2 pour une mesure explicite et centrale ; +1 / −1 pour une orientation, une mesure conditionnelle ou une position rapportée ; 0 pour une position mitigée assumée. Le doute se résout par l'absence de position, pas par une valeur devinée.
4. **Sources primaires d'abord.** Programme, compte rendu de vote, texte du discours. Un article de presse est acceptable s'il cite la personne, et il est signalé `presse` ; un comparateur tiers n'est qu'un point de départ à remplacer.
5. **Quatre yeux.** Une déclaration passe à `verified` uniquement après relecture de la source par une seconde personne, qui n'est pas l'auteur·rice de l'encodage. La validation automatique refuse un `verified` avec moins de deux relecteur·rices.
6. **Contestations.** Un désaccord d'encodage se traite par une issue ; en attendant, la déclaration passe en `disputed` et reste visible avec ce statut.
7. **Égalité de traitement.** Le même effort de documentation est dû à chaque candidat·e classable ; la checklist hebdomadaire les liste tous et toutes.

## Ce que nous ne faisons pas

- Aucun contenu, aucun classement, aucune mise en avant fondée sur les sondages.
- Aucune couleur ou iconographie partisane dans l'interface.
- Aucune rédaction de position « probable » pour combler un vide.
