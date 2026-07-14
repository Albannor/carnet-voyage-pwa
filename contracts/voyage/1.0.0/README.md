# Contrat `voyage.json` 1.0.0

## Statut et emplacement

Le fichier [`schema.json`](schema.json) définit le premier sous-ensemble versionné de `voyage.json`. Il utilise JSON Schema Draft 2020-12 et déclare la version de contenu exacte `1.0.0` dans le champ obligatoire `contentModelVersion`.

Ce contrat est initial et représentatif. Il ne constitue pas encore le format complet et définitif du produit.

## Périmètre couvert

Le schéma décrit :

- le voyage : identifiant stable, titre, destination, langue, fuseau horaire, dates et résumé ;
- un ou plusieurs hébergements, chacun relié à un lieu ;
- les lieux et leurs liens externes explicitement libellés ;
- une ou plusieurs journées datées, contenant des étapes ordonnées ;
- les heures locales optionnelles, les références de lieu ou d'hébergement et les liens de chaque étape ;
- les variantes `standard`, `low-walking` et `rain`, ciblant une journée ou une étape.

Les réservations, ressources, documents, checklists, notes personnelles, données d'état local et règles de présentation sont hors de ce contrat.

## Formats et politiques

- Les identifiants sont des chaînes stables en minuscules, séparables par des tirets, selon le motif documenté dans le schéma.
- Les dates utilisent le format ISO `YYYY-MM-DD` validé par `format: date`.
- Les heures locales utilisent le format `HH:mm` sur 24 heures. Elles sont interprétées dans le fuseau du voyage.
- La langue utilise un sous-ensemble canonique de balises BCP 47 : langue en minuscules, écriture éventuelle avec capitale initiale et région éventuelle en majuscules ou numérique.
- Le fuseau accepte syntaxiquement `UTC` ou une forme IANA avec au moins un `/`. Son existence réelle est ensuite vérifiée par `Intl.DateTimeFormat` lors de la validation métier.
- Une URL doit être une URI syntaxiquement valide. La validation métier applique ensuite une liste fermée : seul le protocole `https:` est accepté dans cette version ; `javascript:`, `data:`, `file:`, `http:` et tout autre protocole sont refusés.
- `additionalProperties: false` est appliqué à chaque objet. Toute propriété inconnue est refusée ; une extension nécessite un contrat versionné qui la déclare.
- Une politique complémentaire signale explicitement les noms de propriétés tentant d'introduire un composant, du HTML, du CSS, un script ou une règle de rendu. Tous les textes restent des données passives et ne doivent jamais être injectés comme HTML.

## Validation en deux niveaux

La validation de frontière, dans `src/contracts/voyage/v1/schemaValidation.ts`, vérifie le schéma et les propriétés de présentation interdites avec des erreurs structurées comprenant une source, un code, un chemin JSON Pointer et un message.

La validation métier, dans `src/domain/voyage/validation.ts`, vérifie ensuite les invariants qui dépassent JSON Schema : unicité des identifiants, cohérence et ordre des dates et heures, résolution des références, existence des cibles de variantes, reconnaissance du fuseau et protocoles d'URL autorisés.

`src/contracts/voyage/v1/document.ts` décrit le document externe tel qu'il est reçu. `src/domain/voyage/model.ts` décrit le modèle interne sans dépendre de React, du stockage ou de JSON Schema. Le convertisseur `toTravel.ts` est explicite afin que ces deux représentations puissent évoluer séparément.

## Exemples et tests

L'exemple représentatif valide se trouve dans `examples/voyage/1.0.0/valid/`. Les fixtures de refus sont regroupées dans `examples/voyage/1.0.0/invalid/` et couvrent les erreurs de schéma, les invariants métier, les références, les variantes, les URL et les tentatives de règle de rendu.

Depuis la racine du dépôt :

```bash
npm run test
```

AJV 8 compile le schéma Draft 2020-12 et `ajv-formats` apporte notamment la validation stricte des dates et des URI. Ces deux dépendances sont limitées à la validation du contrat à l'exécution.

## Limites volontaires

Ce contrat de contenu ne définit ni le `manifest.json` du paquet, ni les répertoires `assets/` et `documents/`. Ces responsabilités appartiennent au [contrat de paquet](../../package/1.0.0/README.md) et à la [chaîne d'import](../../../docs/IMPORT.md). Il ne contient pas encore d'association entre une entité métier et une ressource. L'import normalise cette version vers le modèle interne mais ne persiste aucune donnée et ne rend aucun voyage détaillé dans l'interface.
