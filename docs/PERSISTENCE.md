# Persistance locale et bibliothèque

## Statut

IndexedDB reste la source de vérité locale. La base enregistre uniquement un paquet ayant réussi toute la chaîne d'import et, depuis l’étape 7, les états personnels créés après import. Le ZIP brut et `guide-standalone.html` ne sont jamais conservés.

La couche se trouve dans `src/persistence/`. Elle utilise directement l'API IndexedDB du navigateur, reste indépendante de React et expose l'interface `TravelLibraryRepository`. L'orchestration `src/application/importTravelPackageToLibrary.ts` relie l'import validé au dépôt sans contourner la frontière de confiance.

## Base et version

- nom par défaut : `carnet-voyage` ;
- version IndexedDB : `1` ;
- version du modèle interne normalisé : `4`.

La version IndexedDB évolue séparément des versions externes `manifest.json` et `voyage.json`. La création de la version 1 n'efface aucune base existante. Une base portant une version future est refusée avec `DATABASE_VERSION_INCOMPATIBLE` ; une évolution ultérieure devra ajouter une migration ordonnée au lieu de supprimer silencieusement les données.

## Object stores

| Object store | Clé primaire | Rôle |
| --- | --- | --- |
| `travelMetadata` | `travelId` | Liste légère : paquet, titre, destination, dates, versions source, date d'import et versions internes. |
| `travelContents` | `travelId` | Modèle métier normalisé complet, indépendant du contrat JSON externe. |
| `travelResources` | `[travelId, resourceId]` | Ressources passives validées avec chemin, type MIME, taille, SHA-256 et octets. |
| `personalStates` | `[travelId, namespace, key]` | États personnels versionnés : cases cochées et note générale. |

`travelResources` possède les index `byTravelId` et `byTravelAndPath`. `personalStates` possède l'index `byTravelId`. Le préfixe `travelId` dans les clés et index empêche une lecture ou une suppression de ressource ou d’état sans préciser son voyage.

## États personnels

Les enregistrements portent `version: 1`, une date `updatedAt` et l’un des namespaces suivants :

| Namespace | Clé | Valeur |
| --- | --- | --- |
| `checklist` | `checklistId/itemId` | `{ checked: boolean }` |
| `notes` | `general` | `{ text: string }` |

Les identifiants du contrat n’autorisent pas `/`, ce qui rend la clé de checklist non ambiguë. Avant l’écriture, le dépôt vérifie que la checklist et son élément existent dans le contenu importé du voyage. La note générale est limitée à 10 000 caractères et reste du texte brut.

Le dépôt expose des opérations étroites pour charger l’état personnel complet, cocher ou décocher un élément et enregistrer la note. React n’accède jamais directement à IndexedDB. Une réussite n’est retournée qu’après l’événement `complete` de la transaction ; une erreur conserve la valeur précédemment persistée.

## Transaction d'import

Le parcours effectif est :

1. sélection du ZIP ;
2. validation complète du paquet, du voyage et des ressources ;
3. normalisation vers le modèle interne ;
4. création des enregistrements de stockage ;
5. ouverture d'une seule transaction `readwrite` sur `travelMetadata`, `travelContents` et `travelResources` ;
6. ajout des métadonnées, puis du contenu, puis de chaque ressource ;
7. attente de l'événement `complete` de la transaction ;
8. annonce de la réussite et rechargement de la bibliothèque.

Une erreur d'écriture ou une annulation provoque un rollback complet. L'interface ne reçoit aucune réussite avant la validation effective de la transaction. Le fichier ZIP, le guide HTML et toute donnée non validée restent hors de la base.

## Politique de doublon

`travelMetadata` utilise `travelId` comme clé unique et l'import emploie `add`, jamais un écrasement automatique. Un identifiant existant produit `TRAVEL_ALREADY_EXISTS`. L'utilisateur doit supprimer explicitement le voyage existant avant un nouvel import.

Cette politique évite une mise à jour implicite et protège les états personnels. Aucune fusion ou réimportation avec conservation sélective n'est implémentée ; un doublon ne peut donc pas écraser silencieusement une note ou une case.

## Lecture et isolation

La liste charge seulement `travelMetadata`. L'ouverture récupère les métadonnées et le contenu correspondant au même `travelId`. Une ressource se récupère obligatoirement avec la clé composite `[travelId, resourceId]`, ce qui permet à deux voyages de posséder le même identifiant de ressource sans collision.

L'interface de consultation relit le voyage normalisé et récupère chaque PDF ou image avec la clé composite du voyage courant. Les anciens contenus internes v3 sont adaptés en mémoire vers la version 4 en ajoutant des collections d’illustrations vides, sans modifier la version 1 de la structure IndexedDB. Une image reste stockée avec son type MIME validé et ses octets ; aucune URL d’objet n’est persistée. Un ancien voyage sans état personnel retourne une note vide et aucune case cochée.

## Suppression

La suppression est précédée d'une confirmation qui nomme le voyage. Une transaction unique couvre les quatre object stores :

- les ressources sont sélectionnées par l'index `byTravelId` ;
- les notes et états de checklist sont sélectionnés par leur propre index `byTravelId` ;
- le contenu et les métadonnées sont supprimés par `travelId` ;
- la réussite n'est annoncée qu'après `complete`.

La confirmation indique explicitement que notes et cases cochées seront supprimées. Une suppression ne touche donc ni les ressources ni les états d'un autre voyage. Une erreur annule toute la transaction.

## Erreurs présentables

La persistance retourne des résultats typés et les codes stables suivants :

- `INDEXED_DB_UNAVAILABLE` ;
- `DATABASE_OPEN_FAILED` ;
- `DATABASE_VERSION_INCOMPATIBLE` ;
- `TRANSACTION_ABORTED` ;
- `STORAGE_QUOTA_EXCEEDED` ;
- `TRAVEL_ALREADY_EXISTS` ;
- `TRAVEL_NOT_FOUND` ;
- `RESOURCE_NOT_FOUND` ;
- `DELETE_FAILED` ;
- `READ_FAILED` ;
- `WRITE_FAILED`.

Chaque erreur contient un message, une indication de résolution et, lorsque disponible, l'identifiant du voyage ou de la ressource. Aucune trace technique brute n'est présentée.

## Tests

Les tests IndexedDB utilisent `fake-indexeddb` uniquement en développement. Chaque scénario ouvre un nom de base unique, ferme ses connexions puis supprime la base, ce qui garantit l'indépendance de l'ordre d'exécution. Les paquets valides restent produits en mémoire par les fixtures ZIP de l'étape 3.

```bash
npm run test
```

Les contrôles complets restent :

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Limites volontaires

- les actions contextuelles consultent les ressources existantes mais ne créent ni galerie ni lecteur PDF intégré ;
- une seule note générale en texte brut par voyage ; aucune note multiple, riche, partagée ou avec pièce jointe ;
- aucune fusion ni mise à jour automatique d’un voyage existant ;
- l’enregistrement automatique de la note est temporisé dans l’interface et les cases sont écrites individuellement ;
- aucun service worker ni installation hors ligne complète avant l'étape 9 ;
- aucune migration de structure IndexedDB, mise à jour ou fusion de voyage, puisqu'une seule version de base existe ;
