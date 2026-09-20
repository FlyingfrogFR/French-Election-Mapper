# Conformité RGPD — registre et analyse

Ce document complète la politique de confidentialité affichée dans l'application (`/confidentialite`). Il tient lieu de registre des traitements (art. 30) et d'analyse d'impact allégée pour un traitement portant sur des opinions politiques (art. 9 et 35).

## Principe : conception minimisante

L'architecture élimine le traitement plutôt que de le sécuriser : les réponses ne sont **jamais transmises**. Le site est statique ; le calcul est exécuté dans le navigateur ; il n'existe pas de base de données de réponses, ni côté serveur, ni côté tiers.

| Mesure | Mise en œuvre |
|---|---|
| Aucune ressource tierce | `Content-Security-Policy` dans `index.html` (`default-src 'self'`), police système, aucun CDN. |
| Aucun cookie ni traceur | Aucun script d'analyse ; `referrer: no-referrer`. |
| Stockage local sous contrôle de la personne | Choix explicite entre stockage local (reprise) et session (effacé à la fermeture) ; export JSON ; effacement en un clic (`clearAll`). |
| Information préalable | Encadré affiché avant le questionnaire ; politique complète en une page. |
| Retours anonymes | Opt-in par case à cocher, charge utile fixe et validée côté serveur, compteurs agrégés par jour, aucune IP stockée (`server/`). |

## Registre des traitements

### T1 — Questionnaire et calcul d'affinité

- **Données** : réponses (−2…+2), pondérations, avis sur le résultat. Catégorie particulière : opinions politiques.
- **Responsable** : la personne elle-même sur son appareil. L'éditeur du site n'y a pas accès (exemption art. 2.2.c pour l'usage personnel ; pour l'éditeur, absence de traitement).
- **Destinataires** : aucun. **Transferts** : aucun. **Durée** : à la discrétion de la personne.

### T2 — Retour anonyme facultatif (uniquement si un point de collecte est configuré)

- **Données** : candidat·e suggéré·e, avis (oui / en partie / non), candidat·e attendu·e, tranches de 10 points d'affinité et de confiance, tranche de nombre de réponses, version du jeu de données.
- **Caractère anonyme** : aucune des valeurs n'identifie une personne, même combinées ; pas d'IP, pas d'horodatage infra-journalier, pas d'identifiant de session ; agrégation immédiate en compteurs. Selon la CNIL, des données rendues anonymes sortent du champ du RGPD ; par prudence, le consentement est néanmoins recueilli.
- **Base légale** : consentement explicite (art. 6.1.a et 9.2.a). **Durée** : compteurs conservés sans limite, car non personnels.
- **Sécurité** : validation stricte du format, CORS restreint, limitation de débit en mémoire avec sel horaire.

### T3 — Journaux techniques de l'hébergeur

- **Données** : adresse IP, URL demandée, agent utilisateur, selon l'hébergeur.
- **Base légale** : intérêt légitime (sécurité). **Durée** : celle de l'hébergeur, à documenter dans les mentions légales. Recommandation : choisir un hébergeur de l'UE et désactiver la journalisation des IP ou la réduire à 24 h.

## Droits des personnes

Accès, rectification, effacement et portabilité s'exercent dans l'application, sans intervention de l'éditeur. L'adresse de contact (`VITE_OPERATOR_CONTACT`) est affichée pour toute question et pour la saisine de la CNIL.

## Points d'attention pour l'exploitant

- Ne pas ajouter d'outil de mesure d'audience, même « sans cookie », sans réviser ce document : la CSP le bloquera de toute façon.
- Ne pas placer de reverse proxy qui journalise les corps de requêtes devant le serveur de retours.
- Renseigner les mentions légales (`VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT`, hébergeur).
- Si un jour des réponses devaient être traitées côté serveur (par exemple pour un sondage), une analyse d'impact complète (art. 35) serait obligatoire.
