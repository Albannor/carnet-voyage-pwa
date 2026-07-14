# Persistance locale et bibliothèque

## Statut

L'étape 4 utilise IndexedDB comme source de vérité locale. La base enregistre uniquement un paquet ayant réussi toute la chaîne d'import de l'étape 3. Le ZIP brut et `guide-standalone.html` ne sont jamais conservés.

La couche se trouve dans `src/persistence/`. Elle utilise directement l'API IndexedDB du navigateur, reste indépendante de React et expose l'interface `TravelLibraryRepository`. L'orchestration `src/application/importTravelPackageToLibrary.ts` relie l'import validé au dépôt sans contourner la frontière de confiance.

## Base et version

- nom par défaut : `carnet-voyage` ;
- version IndexedDB : `1` ;
- version du modèle interne normalisé : `1`.

La version IndexedDB évolue séparément des versions externes `manifest.json` et `voyage.json`. La création de la version 1 n'efface aucune base existante. Une base portant une version future est refusée avec `DATABASE_VERSION_INCOMPATIBLE` ; une évolution ultérieure devra ajouter une migration ordonnée au lieu de supprimer silencieusement les données.

## Object stores

| Object store | Clé primaire | Rôle |
| --- | --- | --- |
| `travelMetadata` | `travelId` | Liste légère : paquet, titre, destination, dates, versions source, date d'import et versions internes. |
| `travelContents` | `travelId` | Modèle métier normalisé complet, indépendant du contrat JSON externe. |
| `travelResources` | `[travelId, resourceId]` | Ressources passives validées avec chemin, type MIME, taille, SHA-256 et octets. |
| `personalStates` | `[travelId, namespace, key]` | Espace réservé aux futurs états personnels, sans fonctionnalité de note ou de checklist à cette étape. |

`travelResources` possède les index `byTravelId` et `byTravelAndPath`. `personalStates` possède l'index `byTravelId`. Le préfixe `travelId` dans les clés et index empêche une lecture ou une suppression de ressource sans préciser son voyage.

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

Cette politique évite une mise à jour implicite et prépare la protection des futurs états personnels. Aucune fusion ou réimportation avec conservation sélective n'est implémentée.

## Lecture et isolation

La liste charge seulement `travelMetadata`. L'ouverture récupère les métadonnées et le contenu correspondant au même `travelId`. Une ressource se récupère obligatoirement avec la clé composite `[travelId, resourceId]`, ce qui permet à deux voyages de posséder le même identifiant de ressource sans collision.

L'interface affiche uniquement une bibliothèque et un aperçu minimal : titre, destination, dates et résumé. La navigation par journée et la consultation détaillée appartiennent à l'étape 5.

## Suppression

La suppression est précédée d'une confirmation qui nomme le voyage. Une transaction unique couvre les quatre object stores :

- les ressources sont sélectionnées par l'index `byTravelId` ;
- les futurs états personnels sont sélectionnés par leur propre index `byTravelId` ;
- le contenu et les métadonnées sont supprimés par `travelId` ;
- la réussite n'est annoncée qu'après `complete`.

Une suppression ne touche donc ni les ressources ni les états d'un autre voyage. Une erreur annule toute la transaction.

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

- aucune consultation détaillée, navigation par journée ou vue « Aujourd'hui » avant l'étape 5 ;
- aucune note ni checklist avant l'étape 7 ; seul leur object store séparé est réservé ;
- aucun service worker ni installation hors ligne complète avant l'étape 8 ;
- aucune mise à jour, fusion ou migration réelle d'une ancienne base, puisqu'une seule version existe ;
- aucune galerie ou lecture complète des ressources à cette étape.
