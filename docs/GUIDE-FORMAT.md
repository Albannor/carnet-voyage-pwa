# Format conceptuel des guides

## Objet du document

Ce document décrit le paquet de voyage, les responsabilités de ses éléments et les règles d'évolution. Les premiers contrats de `manifest.json` et `voyage.json` sont désormais versionnés ; ils ne constituent pas le format définitif du produit et ne fixent pas encore tous les champs futurs.

## Structure proposée

```text
paquet-voyage/
├── manifest.json
├── voyage.json
├── assets/
├── documents/
└── guide-standalone.html
```

Le paquet transportable est une archive ZIP dont ces éléments se trouvent directement à la racine. Les fichiers JSON sont les seules sources structurées interprétées par l'application.

## Responsabilité de chaque élément

### `manifest.json`

Le manifest décrit le paquet, pas la PWA. Il permet de décider si le paquet peut être ouvert avant d'interpréter son contenu métier.

Il est destiné à porter :

- l'identifiant stable du paquet ou du voyage ;
- la version du format de paquet ;
- la version minimale ou la plage de compatibilité attendue du lecteur ;
- l'emplacement et l'empreinte éventuelle du fichier `voyage.json` ;
- l'inventaire des ressources, leurs types, tailles et empreintes ;
- les métadonnées techniques nécessaires au contrôle d'intégrité.

La première version prise en charge est `1.0.0`, définie dans [`contracts/package/1.0.0/schema.json`](../contracts/package/1.0.0/schema.json). Elle impose un inventaire fermé, une taille et une empreinte SHA-256 pour chaque ressource. Ce fichier n'est pas dérivé d'un Web App Manifest et ne contient pas la configuration d'installation de l'application.

### `voyage.json`

Ce fichier porte le contenu métier structuré du voyage. Il décrit ce que l'utilisateur consulte, indépendamment de la manière dont l'application l'affiche.

Il est destiné à représenter les entités conceptuelles suivantes :

- **Voyage** : identité, titre, destination, période, fuseau horaire, langue et résumé ;
- **Participants ou contexte** : informations éditoriales strictement utiles au déroulement, sans créer de comptes ;
- **Hébergement** : un ou plusieurs points d'ancrage avec période, adresse et références de lieu ;
- **Journée** : date locale, titre, résumé, priorités et ordre de consultation ;
- **Étape** : heure ou plage horaire, durée, description, importance, lieu et ressources associées ;
- **Lieu** : nom, adresse et liens externes explicites ;
- **Itinéraire** : origine, destination, étapes intermédiaires, mode de déplacement et lien vers un service externe ;
- **Variante ou plan B** : adaptation standard, économe en marche, pluie ou autre alternative explicitement décrite ;
- **Réservation** : référence utile, horaire, statut éditorial et document associé, sans fonction de paiement ;
- **Document** : métadonnées et référence vers un fichier passif du répertoire `documents/` ;
- **Checklist** : définition d'éléments à cocher ;
- **Lien utile** : libellé, destination, contexte et indication qu'une connexion peut être nécessaire.

Le contenu utilise des identifiants stables et uniques dans le paquet. Les relations sont exprimées par ces identifiants plutôt que par la position visuelle ou le nom d'un élément.

### `assets/`

Ce répertoire contient les ressources de présentation passives nécessaires à la consultation, par exemple des images. Les ressources :

- sont déclarées dans le manifest ;
- utilisent des chemins relatifs normalisés ;
- ont un type et une taille autorisés ;
- ne contiennent aucun comportement attendu par l'application ;
- restent optionnelles lorsque leur absence ne nuit pas à l'information essentielle.

Le rendu et les styles appartiennent toujours à l'application. Une ressource ne peut pas remplacer un composant d'interface.

### `documents/`

Ce répertoire contient les documents utiles au voyage, par exemple une confirmation ou un billet dans un format passif accepté. Chaque document est déclaré et relié à une entité de `voyage.json`.

L'application contrôle leur ouverture ou leur téléchargement. Elle refuse les formats exécutables et ne suit jamais un chemin situé hors du paquet.

### `guide-standalone.html`

Ce fichier est une représentation autonome optionnelle destinée à un usage extérieur à l'application, à l'archivage ou à la compatibilité avec un processus de génération existant.

Il n'est jamais :

- la source de vérité du contenu ;
- analysé pour reconstruire `voyage.json` ;
- rendu dans l'application ;
- chargé dans une iframe ou une vue web ;
- autorisé à exécuter ses scripts dans le contexte de l'application.

L'import doit pouvoir réussir sans ce fichier. S'il est présent, il est traité comme une pièce opaque non exécutable ou ignoré selon la politique retenue.

## Données importées et état personnel

Le paquet décrit le voyage préparé ; l'application conserve séparément les interactions personnelles.

Relèvent du paquet :

- le texte d'une étape ;
- la définition d'un élément de checklist ;
- une suggestion de note ou un document associé ;
- les variantes et liens préparés.

Relèvent de l'état local de l'application :

- le fait qu'une case soit cochée ;
- le texte des notes personnelles ;
- les préférences de consultation ;
- la dernière journée ouverte.

Cette séparation évite qu'une réimportation remplace silencieusement les données personnelles. Les identifiants stables servent à réconcilier l'état lorsque le contenu évolue.

## Règles conceptuelles de données

- Les dates et heures utilisent des formats non ambigus et sont interprétées avec le fuseau horaire du voyage.
- L'ordre chronologique est porté par les données, pas déduit de la mise en page.
- Toute référence à une ressource ou une autre entité doit pouvoir être résolue dans le paquet.
- Les textes sont du texte, pas du HTML à injecter.
- Les URL externes sont explicites, étiquetées et soumises à une liste de protocoles autorisés ; les URL actives telles que `javascript:` sont interdites.
- Les chemins sont relatifs, sans remontée de répertoire, encodage ambigu ou collision de casse.
- Les éléments essentiels restent compréhensibles sans image ni service externe.
- L'absence d'une variante, d'une réservation ou d'un document est valide lorsqu'elle est cohérente avec le contenu.
- Le format transporte des données et des relations, jamais des règles de rendu ou du code.

## Versionnement

Deux versions externes sont distinguées :

- la **version du format de paquet**, déclarée par `manifest.json`, couvre l'organisation, l'intégrité et les types de fichiers ;
- la **version du modèle de contenu**, déclarée par `voyage.json`, couvre les entités, champs et relations métier.

Le principe de versionnement suit `MAJEUR.MINEUR.CORRECTIF` :

- `MAJEUR` change lorsqu'un lecteur existant ne peut plus interpréter correctement le format ;
- `MINEUR` change lors d'un ajout rétrocompatible, principalement par champs ou entités optionnels ;
- `CORRECTIF` change lors d'une correction ou clarification sans modification de contrat.

Un lecteur :

1. vérifie d'abord la version et l'intégrité du paquet ;
2. vérifie ensuite la version du contenu ;
3. valide le schéma correspondant ;
4. applique, si elle existe, une chaîne de migrations explicites vers son modèle interne courant ;
5. refuse proprement toute version inconnue ou non migrable.

Les champs inconnus ne sont tolérés que si la version et le futur schéma les déclarent compatibles. Aucun comportement ne doit être deviné silencieusement.

## Contrat initial de `voyage.json`

Le premier contrat de contenu est la version `1.0.0`. Son schéma JSON Schema Draft 2020-12 se trouve dans [`contracts/voyage/1.0.0/schema.json`](../contracts/voyage/1.0.0/schema.json). Sa documentation détaillée et ses politiques de validation figurent dans le [`README` du contrat](../contracts/voyage/1.0.0/README.md).

Ce sous-ensemble couvre l'identité et la période du voyage, la destination, la langue, le fuseau horaire, les hébergements, les lieux, les journées, leurs étapes, les liens externes et trois catégories de variantes. Les réservations, ressources du paquet, documents, checklists, notes et migrations réelles restent volontairement absents.

Le contrat externe décrit la forme acceptée à la frontière de l'application. Le modèle interne TypeScript, situé dans `src/domain/voyage/`, décrit les concepts utilisés par le domaine et leurs invariants sans dépendre de JSON Schema, de React ou du stockage. Une conversion explicite relie les deux ; leur ressemblance actuelle n'en fait pas une seule couche.

La politique initiale refuse toute propriété inconnue. Une extension du contenu exige donc une nouvelle version déclarée du contrat, au lieu d'être interprétée silencieusement. La référence Madrid fournit uniquement des cas d'usage et une inspiration éditoriale : son HTML et son manifest PWA ne servent pas de schéma implicite.

## Import implémenté

La chaîne d'import ZIP, ses limites de sécurité, les types de ressources passives autorisées et le registre de normalisation sont documentés dans [`docs/IMPORT.md`](IMPORT.md). Elle accepte uniquement les versions de paquet et de contenu `1.0.0`.

Après validation complète, l'étape 4 conserve le modèle normalisé et les ressources passives dans des espaces IndexedDB isolés par voyage. Le ZIP brut et `guide-standalone.html` ne sont pas stockés. Cette persistance est documentée dans [`docs/PERSISTENCE.md`](PERSISTENCE.md).
