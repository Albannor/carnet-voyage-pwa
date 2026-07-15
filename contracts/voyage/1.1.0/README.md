# Contrat `voyage.json` 1.1.0

Cette version mineure étend le contrat `1.0.0` pour les actions contextuelles de l’étape 6. Le schéma [`schema.json`](schema.json) utilise JSON Schema Draft 2020-12 et conserve une politique `additionalProperties: false` à tous les niveaux.

## Ajouts optionnels

- `documents` référence des ressources du manifest par `resourceId`. L’import exige une ressource déclarée de type `application/pdf`.
- `reservations` contient un libellé, des métadonnées facultatives, des liens HTTPS facultatifs et des références explicites vers des documents.
- `documentIds` et `reservationIds` rattachent ces entités à une journée ou une étape par identifiant stable.

Aucune association n’est déduite d’un chemin, d’un nom de fichier, d’un libellé ou de la position d’un élément. Les collections absentes sont normalisées en tableaux vides dans le modèle interne.

## Limites et validation

Le contrat limite les documents et réservations à 200 éléments chacun, et chaque liste d’association à 50 identifiants uniques. Les longueurs de texte reprennent les bornes du contrat initial. Le schéma contrôle la forme ; la validation métier contrôle l’unicité globale, les références entre entités, HTTPS et les cibles de variantes. La frontière ZIP vérifie ensuite la présence et le type PDF des ressources dans `manifest.json`.

La version de paquet reste `1.0.0`. `manifest.travelModelVersion` doit être exactement identique à `voyage.contentModelVersion`. Les contrats `voyage.json` `1.0.0` et `1.1.0` possèdent chacun leur propre schéma et leur propre normaliseur ; toute autre version est refusée.

## Exemples et tests

- exemple valide : [`examples/voyage/1.1.0/valid/coastal-trip.json`](../../../examples/voyage/1.1.0/valid/coastal-trip.json) ;
- exemples invalides : [`examples/voyage/1.1.0/invalid/`](../../../examples/voyage/1.1.0/invalid/).

```bash
npm run test
```

Cette version ne définit ni checklist, ni note personnelle, ni paiement, ni intégration de réservation. Elle n’est pas présentée comme le format définitif du produit.
