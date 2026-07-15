# Contrat `voyage.json` 1.2.0

Cette version ajoute des définitions de checklists au contenu structuré de la version 1.1.0. Le paquet ZIP et son `manifest.json` restent en version 1.0.0.

Chaque checklist possède un identifiant unique dans le voyage, une cible explicite (`travel`, `day` ou `step`) et une liste ordonnée d’éléments. Un identifiant d’élément est unique dans sa checklist ; la paire `checklistId` / `itemId` forme donc une clé stable et non ambiguë pour l’état personnel.

Limites : 100 checklists par voyage, 100 éléments par checklist, 160 caractères pour les titres et libellés, 1 000 caractères pour les descriptions de checklist et d’élément. Les listes d’éléments ne peuvent pas être vides et `additionalProperties: false` s’applique à tous les objets.

Les cases cochées et les notes ne figurent jamais dans ce contrat : elles sont créées localement et conservées séparément dans IndexedDB.

Les versions 1.0.0 et 1.1.0 restent prises en charge. `manifest.travelModelVersion` doit toujours être identique à `contentModelVersion`.

L’exemple complet [`examples/voyage/1.2.0/valid/coastal-checklists.json`](../../../examples/voyage/1.2.0/valid/coastal-checklists.json) couvre les trois portées. Les fragments invalides de [`examples/voyage/1.2.0/invalid/checklist-cases.json`](../../../examples/voyage/1.2.0/invalid/checklist-cases.json) documentent les propriétés inconnues, doublons, cibles inconnues ou incohérentes, cardinalités et textes invalides ; les tests construisent à partir d’eux des documents complets reproductibles.
