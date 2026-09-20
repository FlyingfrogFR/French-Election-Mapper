# Déploiement

## Prérequis

Node.js 22 (`.nvmrc`), npm. Aucune base de données, aucun service tiers.

## Construction

```bash
npm ci
npm run check      # validation des données, types, tests, tests du serveur
npm run build      # → dist/ (le jeu de données est regénéré automatiquement avant)
```

Variables d'environnement lues à la construction (toutes facultatives) :

| Variable | Rôle |
|---|---|
| `VITE_BASE_PATH` | Sous-chemin de déploiement (`/` par défaut, `/nom-du-depot/` sur GitHub Pages). |
| `VITE_SITE_URL` | URL publique, utilisée dans le flux RSS. |
| `VITE_REPO_URL` | URL du dépôt affichée dans l'interface. |
| `VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT` | Mentions légales et politique de confidentialité. |
| `VITE_FEEDBACK_ENDPOINT` | URL du serveur de retours anonymes (`https://…/feedback`). Vide = fonction désactivée. |
| `VITE_FEEDBACK_ORIGIN` | Origine du serveur de retours, ajoutée à la CSP (`https://retours.example`). |
| `SOURCE_DATE_EPOCH` | Fige la date de génération pour une construction reproductible. |

## GitHub Pages (par défaut)

`deploy-pages.yml` déploie `main` à chaque poussée. Activer Pages (Settings → Pages → Source : GitHub Actions). Pour un domaine personnalisé, définir la variable de dépôt `VITE_BASE_PATH=/`.

## Autre hébergeur statique

Servir `dist/` avec une réécriture de toutes les routes vers `index.html` (ou utiliser le `404.html` généré). Recommandation d'en-têtes HTTP (exemple `public/_headers`, format Netlify / Cloudflare Pages) :

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()
```

Ajouter l'origine du serveur de retours à `connect-src` si vous l'utilisez.

## Serveur de retours (facultatif)

Voir `server/README.md`. Hébergez-le dans l'UE, derrière TLS, sans journalisation des corps de requêtes.

## Vérification après déploiement

Le pied de page doit afficher la révision git attendue et l'empreinte de `public/data/VERSION` de cette révision.
