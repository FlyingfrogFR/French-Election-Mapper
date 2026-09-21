# Serveur de retours anonymes (facultatif)

Le site fonctionne entièrement sans serveur. Ce dossier contient l'implémentation de référence de l'unique point
de collecte possible : l'avis anonyme « ce résultat vous paraît-il juste ? », envoyé **seulement** si l'exploitant
configure `VITE_FEEDBACK_ENDPOINT` à la construction du site **et** si la personne coche la case de consentement.

## Ce qui est reçu, et rien d'autre

```json
{ "v": 1, "datasetVersion": "9f4f0cf364ea", "suggested": "melenchon", "agreement": "partly",
  "expected": "roussel", "matchBucket": "70-79", "confidenceBucket": "60-69", "answeredBucket": "80-119" }
```

Tout champ supplémentaire, toute valeur hors format, est rejeté (HTTP 400). Le serveur :

- n'enregistre **aucune** adresse IP, aucun agent utilisateur, aucun horodatage plus fin que le jour ;
- ne stocke que des compteurs agrégés (`jour | version | suggéré | avis | attendu | tranches`) ;
- limite le débit en mémoire avec un hachage salé de l'adresse IP dont le sel change toutes les heures ; rien n'est écrit sur disque ;
- n'accepte que les origines listées dans `FEEDBACK_ORIGINS` (CORS) ;
- expose `GET /stats` : les compteurs, publics puisqu'ils ne contiennent aucune donnée personnelle.

## Lancer

```bash
FEEDBACK_ORIGINS=https://votre-site.example PORT=8787 node server/feedback-server.mjs
node --test server/*.test.mjs  # tests
```

Le fichier de compteurs (`server/store/feedback-counters.json` par défaut, variable `FEEDBACK_STORE`) est ignoré par git.
Placez le serveur derrière un reverse proxy TLS ; ne journalisez pas les corps de requêtes ni les adresses IP au niveau du proxy
si vous voulez conserver la garantie « aucune donnée individuelle ».
