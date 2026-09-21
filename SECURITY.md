# Sécurité

Le site ne traite aucune donnée personnelle côté serveur ; la surface d'attaque principale est l'intégrité des données affichées.

Signalez une vulnérabilité (injection dans l'interface, contournement de la CSP, faille du serveur de retours, faiblesse du processus de relecture) par issue privée « Security advisory » sur GitHub, ou à l'adresse de contact indiquée dans les mentions légales du site déployé. Merci de ne pas publier de détail exploitable avant correction.

Ce qui est en place : CSP stricte sans ressource tierce, aucun cookie, validation de schéma sur toutes les données, relecture à quatre yeux, empreinte du jeu de données publiée, dépendances mises à jour par Dependabot.
