# Import sécurisé des paquets de voyage

## Statut

L'étape 3 accepte et valide un paquet ZIP dans le navigateur. Cette frontière retourne toujours le paquet validé en mémoire, sans connaître IndexedDB. Depuis l'étape 4, une orchestration distincte transmet ensuite ce résultat complet au dépôt local ; un échec d'import ne déclenche aucune écriture.

Le code de la frontière d'import se trouve dans `src/import/`. Il est indépendant de React et de la persistance. L'interface appelle cette frontière sans accéder directement au contenu de l'archive.

L'enregistrement atomique, la politique de doublon et la bibliothèque sont documentés dans [`docs/PERSISTENCE.md`](PERSISTENCE.md). Ni le ZIP brut ni `guide-standalone.html` ne sont persistés.

## Format et versions prises en charge

Le ZIP contient directement les éléments suivants à sa racine :

```text
paquet-voyage.zip
├── manifest.json
├── voyage.json
├── assets/                    # optionnel, ressources déclarées uniquement
├── documents/                 # optionnel, ressources déclarées uniquement
└── guide-standalone.html      # optionnel, opaque et ignoré
```

Les seules versions acceptées sont :

- format du paquet : `1.0.0` ;
- modèles de contenu de `voyage.json` : `1.0.0`, `1.1.0` et `1.2.0`.

Le schéma Draft 2020-12 du manifest se trouve dans [`contracts/package/1.0.0/schema.json`](../contracts/package/1.0.0/schema.json). Ce manifest technique ne configure pas l'installation de la PWA et ne remplace pas `public/manifest.webmanifest`.

Le manifest déclare l'identifiant du paquet, les deux versions, le chemin exact `voyage.json`, la politique fermée des fichiers et l'inventaire des ressources. Chaque ressource possède un identifiant stable, un chemin, un type, une taille en octets et une empreinte SHA-256 hexadécimale obligatoire.

## Ressources passives autorisées

La liste est fermée :

| Type déclaré | Extensions | Répertoire |
| --- | --- | --- |
| `image/png` | `.png` | `assets/` |
| `image/jpeg` | `.jpg`, `.jpeg` | `assets/` |
| `image/webp` | `.webp` | `assets/` |
| `application/pdf` | `.pdf` | `documents/` |

L'import contrôle la cohérence du type, de l'extension, de la signature binaire, de la taille et de l'empreinte. SVG, HTML affichable, JavaScript, CSS, exécutables et tout type non listé sont refusés.

`guide-standalone.html` constitue la seule exception de structure. Il n'est pas déclaré comme ressource, n'est jamais analysé, renvoyé comme HTML, exécuté, injecté dans le DOM ou chargé dans une iframe. Sa présence est seulement signalée par un booléen technique.

Le contrat `voyage.json` `1.0.0` ne porte aucune association métier vers les ressources. Le contrat `1.1.0` ajoute des documents dont le `resourceId` doit résoudre une ressource déclarée `application/pdf`, ainsi que des réservations et associations explicites par identifiant. Le contrat `1.2.0` ajoute les définitions de checklists ; celles-ci ne référencent aucune ressource et leur état coché n’est pas importé. Aucun rapprochement par chemin, libellé ou position n'est réalisé.

## Limites de sécurité

Les valeurs sont centralisées et testables dans `src/import/limits.ts` :

| Limite | Valeur MVP |
| --- | ---: |
| Taille du ZIP sélectionné | 25 Mio |
| Taille totale décompressée | 75 Mio |
| Taille d'un fichier | 20 Mio |
| Nombre total d'entrées ZIP | 120 |
| Profondeur d'un chemin | 5 segments |
| Longueur d'un chemin | 180 caractères |
| Taille de `manifest.json` | 128 Kio |
| Taille de `voyage.json` | 2 Mio |
| Ratio de compression | 100:1 au-delà de 1 Kio |

Le répertoire central du ZIP est inspecté avant extraction. L'import refuse notamment ZIP64, les archives segmentées, chiffrées ou utilisant une compression autre que Store ou Deflate, les tailles incohérentes, les CRC incorrects, les traversées `..`, chemins absolus, antislashs, segments ambigus, doublons exacts et collisions de casse.

Cette inspection borne la mémoire décompressée dans les limites permises par la bibliothèque. `fflate` est utilisé uniquement après ces contrôles pour décompresser l'archive en mémoire. Cette bibliothèque légère, sans dépendance transitive et compatible navigateur, ne décide d'aucune politique métier ou de sécurité.

## Chaîne de validation

L'import suit ces étapes, sans exposer de résultat intermédiaire :

1. contrôle du nom, du type et de la taille du fichier sélectionné ;
2. lecture des octets du ZIP ;
3. inspection de son répertoire central et de ses en-têtes locaux ;
4. validation et normalisation stricte de tous les chemins ;
5. contrôle des limites, méthodes de compression, CRC et structure ;
6. présence et analyse JSON UTF-8 de `manifest.json` ;
7. contrôle de la version puis validation du schéma du manifest ;
8. contrôle de l'inventaire fermé ;
9. analyse JSON UTF-8 de `voyage.json` et cohérence des versions ;
10. réutilisation du schéma et des politiques de l'étape 2 ;
11. réutilisation des invariants métier de l'étape 2 ;
12. normalisation versionnée vers le modèle interne ;
13. vérification des références documentaires contre le manifest ;
14. vérification des ressources déclarées, signatures, tailles et SHA-256 ;
15. production atomique du paquet validé en mémoire.

Tout échec retourne uniquement un résultat `{ ok: false }`. Aucun champ `package`, voyage ou tableau de ressources partiel n'est exposé.

## Normalisation et migrations

`src/import/migrations/registry.ts` contient un registre explicite et sans effet de bord. Les entrées `1.0.0`, `1.1.0` et `1.2.0` utilisent chacune leur propre validateur de schéma et leur propre normaliseur vers le modèle interne courant. Les normaliseurs 1.0.0 et 1.1.0 initialisent les checklists avec une collection vide ; le normaliseur 1.2.0 conserve leurs cibles et l’ordre de leurs éléments.

Aucune ancienne version fictive n'a été inventée. Une version inconnue est refusée avant interprétation ; un normaliseur absent ou en échec produit respectivement `MIGRATION_UNAVAILABLE` ou `MIGRATION_FAILED`.

## Erreurs présentables

Chaque erreur expose :

- une catégorie : validation, version incompatible, limite, archive corrompue, ressource ou migration ;
- un code stable ;
- un message en français ;
- le fichier et le champ JSON Pointer lorsqu'ils sont connus ;
- une indication de correction destinée à l'interface.

Les codes propres au paquet couvrent notamment `ARCHIVE_CORRUPTED`, `ARCHIVE_EMPTY`, `FILE_COUNT_EXCEEDED`, `TOTAL_SIZE_EXCEEDED`, `COMPRESSION_RATIO_EXCEEDED`, `PATH_TRAVERSAL`, `PATH_ABSOLUTE`, `PATH_DUPLICATE`, `PATH_CASE_COLLISION`, `REQUIRED_FILE_MISSING`, `PACKAGE_VERSION_UNSUPPORTED`, `TRAVEL_VERSION_UNSUPPORTED`, `RESOURCE_UNDECLARED`, `RESOURCE_MISSING`, `RESOURCE_SIZE_MISMATCH`, `RESOURCE_HASH_MISMATCH`, `RESOURCE_TYPE_UNSUPPORTED`, `DOCUMENT_RESOURCE_UNKNOWN`, `DOCUMENT_RESOURCE_NOT_PDF`, `MIGRATION_UNAVAILABLE` et `MIGRATION_FAILED`.

Les codes structurés du contrat et du domaine, tels que `SCHEMA_REQUIRED`, `DUPLICATE_ID`, `UNKNOWN_PLACE_REFERENCE` et `UNSUPPORTED_URL_PROTOCOL`, sont conservés et contextualisés avec `voyage.json`.

## Paquets de test

Les archives de test sont produites en mémoire par `src/import/test/packageFixtures.ts` avec `fflate`. Le générateur calcule une empreinte réelle, construit le manifest, ajoute `voyage.json` et permet d'omettre, remplacer ou injecter une entrée pour tester un refus. Aucun gros ZIP binaire n'est conservé dans le dépôt.

Pour exécuter les scénarios :

```bash
npm run test
```

Les contrôles complets du projet restent :

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
