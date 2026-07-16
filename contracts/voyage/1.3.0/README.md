# Contrat `voyage.json` 1.3.0

Cette version reprend intégralement `1.2.0` et ajoute des illustrations locales structurées. Le format ZIP et `manifest.json` restent en version `1.0.0`.

Une illustration référence exclusivement, par `resourceId`, une ressource PNG, JPEG ou WebP déclarée dans le manifest. `sourceUrl` et `licenseUrl` décrivent la provenance d’une photographie sous licence ; elles ne servent jamais à charger l’image.

Les associations sont explicites :

- `coverIllustrationId` pour la couverture du voyage ;
- `illustrationIds` sur une journée ;
- `illustrationIds` sur une étape.

Le schéma limite un voyage à 100 illustrations et chaque contexte à 100 références uniques. `alt` est obligatoire (300 caractères maximum), `caption` est optionnelle (500 caractères maximum) et toutes les formes de provenance sont fermées par `additionalProperties: false`.

Les versions `1.0.0`, `1.1.0` et `1.2.0` restent prises en charge et sont normalisées avec une collection d’illustrations vide.
