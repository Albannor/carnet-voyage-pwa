# Architecture

## Objet du document

Ce document fixe les invariants techniques et les responsabilités de la future application. Il ne définit ni l'expérience produit détaillée, ni le schéma JSON final du format d'import.

## Vue d'ensemble local-first

Carnet de voyage PWA sera une application React et TypeScript construite avec Vite, distribuée comme un ensemble de fichiers statiques. Dans le MVP, aucun backend n'intervient dans le parcours principal.

Le fonctionnement repose sur deux ensembles locaux distincts :

1. Le **shell applicatif** contient l'interface, les règles de rendu et la logique de consultation. Il est mis en cache par le service worker.
2. Les **données utilisateur** contiennent les voyages validés, leurs ressources locales et les états personnels. Elles sont conservées sur l'appareil, principalement dans IndexedDB.

Le réseau est un enrichissement, pas une condition de lecture. Il reste nécessaire pour la première installation, les mises à jour du shell et l'ouverture de services externes.

## Séparation entre application et dossiers de voyage

L'application possède et contrôle :

- les composants visuels et les règles UX ;
- la validation, la normalisation et les migrations ;
- la persistance et l'isolation des voyages ;
- l'interprétation des données du voyage ;
- la stratégie hors ligne et la politique de sécurité.

Un dossier de voyage fournit uniquement :

- du contenu structuré et versionné ;
- des identifiants stables et des relations entre entités ;
- des ressources passives, telles que des images ou des documents autorisés ;
- des liens externes explicites.

Le dossier ne peut pas fournir de composant React, de feuille de style active, de comportement, de script ou de règle de stockage. Son apparence dans l'application dépend exclusivement du shell applicatif.

Le fichier éventuel `guide-standalone.html` du paquet est un artefact autonome de consultation ou d'archivage. L'application ne l'utilise ni comme source de données, ni comme vue embarquée, et ne l'exécute jamais.

## Chaîne d'import

L'import suit une frontière de confiance explicite :

```text
Paquet non fiable
    → contrôle de structure et de taille
    → lecture des seuls fichiers attendus
    → analyse JSON sans évaluation de code
    → validation de version et de schéma
    → contrôle des références, types et URL
    → migration vers le modèle interne courant
    → enregistrement atomique dans IndexedDB
    → rendu par l'application
```

Un échec à n'importe quelle étape annule l'import et produit une erreur compréhensible. Un voyage partiellement validé ne doit pas devenir visible dans la bibliothèque.

Depuis l'étape 4, l'orchestration transmet le paquet complet normalisé au dépôt IndexedDB. Une seule transaction écrit métadonnées, contenu et ressources ; la bibliothèque n'est actualisée qu'après sa validation. Les limites et contrôles ZIP sont détaillés dans `IMPORT.md`, et le modèle de base dans `PERSISTENCE.md`.

Depuis l’étape 5, la consultation relit toujours le modèle normalisé par l’interface de dépôt avant de le rendre. Les composants de voyage reçoivent ce modèle déjà chargé et ne connaissent ni IndexedDB, ni l’archive d’origine. L’identifiant du voyage et la vue active peuvent être reflétés dans l’URL pour permettre un rechargement ; ce contexte de navigation ne contient aucun contenu métier et n’est pas stocké dans `localStorage`. Les règles de date, de fuseau et de sélection d’hébergement sont indépendantes de React et décrites dans `CONSULTATION.md`.

## Stockage local

IndexedDB est la source de vérité locale pour :

- les métadonnées de bibliothèque ;
- le contenu normalisé des voyages ;
- les ressources importées qui doivent être disponibles hors ligne ;
- les états personnels, notamment checklists et notes ;
- la version interne utilisée pour les migrations.

Le contenu importé et l'état personnel sont séparés logiquement. Une mise à jour ou une réimportation ne doit pas écraser silencieusement les notes ou les cases cochées. Les identifiants stables permettent de rattacher ces états au bon voyage et au bon élément.

Les écritures importantes sont transactionnelles. La suppression d'un voyage efface son contenu et ses états associés uniquement après une action explicite de l'utilisateur.

La base IndexedDB initiale porte la version `1` et sépare quatre object stores : `travelMetadata`, `travelContents`, `travelResources` et `personalStates`. Les ressources et états personnels sont indexés par `travelId` ; leurs clés composites commencent par cet identifiant. La politique initiale refuse tout doublon au lieu d'écraser un voyage existant. Le détail des clés, transactions et erreurs figure dans `PERSISTENCE.md`.

Le `localStorage` n'est pas la base métier. Il peut, si nécessaire, conserver des préférences simples et non sensibles de l'interface, sans devenir une dépendance du modèle de voyage.

## Fonctionnement hors ligne

Le service worker met en cache une version cohérente du shell applicatif et gère sa mise à jour. Les données de voyage restent dans IndexedDB ; elles ne doivent pas être confondues avec le cache réseau.

Les règles suivantes s'appliquent :

- après installation réussie, le shell démarre sans réseau ;
- après import réussi, les données et ressources locales déclarées comme nécessaires sont consultables hors ligne ;
- les mises à jour du shell sont versionnées afin d'éviter le mélange de fichiers incompatibles ;
- une mise à jour ne supprime pas les voyages locaux ;
- les ressources externes ne sont pas promises hors ligne ;
- l'interface indique clairement lorsqu'une action va quitter l'application ou nécessite le réseau.

Le MVP ne cherche pas à mettre en cache un moteur cartographique complet ni des contenus tiers arbitraires.

## Sécurité des importations

Tout paquet est non fiable, même s'il a été produit par ChatGPT ou créé par l'utilisateur.

Les protections minimales sont :

- accepter seulement la structure et les types de fichiers explicitement pris en charge ;
- imposer des limites de taille, de nombre de fichiers et de profondeur d'archive ;
- refuser les chemins absolus, traversées de répertoires, doublons ambigus et références hors paquet ;
- analyser le JSON comme donnée et ne jamais utiliser `eval`, `Function`, import dynamique ou injection de script ;
- valider chaque donnée avant persistance, y compris les identifiants, dates, références et URL ;
- refuser les protocoles actifs ou dangereux et ouvrir les services externes au moyen de liens contrôlés ;
- rendre les textes comme du contenu, sans HTML non fiable ;
- servir les ressources passives avec un type autorisé et ne jamais traiter un fichier importé comme code applicatif ;
- ne pas afficher `guide-standalone.html` dans une iframe ou une vue web de l'application ;
- conserver des messages d'erreur qui aident l'utilisateur sans exposer de détails sensibles.

La validation de schéma est nécessaire mais non suffisante : les contrôles sémantiques et les limites de ressources font partie de la même frontière de sécurité.

## Versionnement et migrations

Le format externe et le modèle interne évoluent séparément :

- `manifest.json` déclare la version du format de paquet et les compatibilités nécessaires ;
- `voyage.json` déclare la version de son modèle de contenu ;
- IndexedDB porte une version du modèle de persistance de l'application.

Une version majeure signale une incompatibilité qui ne peut pas être interprétée sans migration explicite. Une évolution mineure reste rétrocompatible pour un lecteur conforme, notamment par l'ajout de champs optionnels. Les correctifs clarifient ou corrigent le format sans en changer le sens.

L'import conserve la version d'origine à des fins de diagnostic, mais l'application travaille avec un modèle interne normalisé. Les migrations sont :

- déterministes et ordonnées ;
- indépendantes du rendu ;
- couvertes par des tests à partir de fixtures ;
- exécutées avant l'écriture du voyage actif ;
- sans perte silencieuse d'information ou d'état personnel.

Une version future inconnue est refusée proprement. Une ancienne version n'est acceptée que si une chaîne de migration prise en charge existe.

## Responsabilités des futures couches

### Présentation

Les pages et composants React rendent le modèle interne selon les règles UX communes. Ils gèrent l'accessibilité, la navigation et les états visuels, sans lire directement les archives ou IndexedDB.

### Application

Les cas d'usage orchestrent import, liste, ouverture, suppression, sélection de journée, mise à jour des notes et checklists. Ils définissent les transitions et les erreurs visibles, sans dépendre des détails du navigateur.

### Domaine

Le domaine porte les entités normalisées, leurs identifiants, relations et invariants : voyage, journées, étapes, lieux, hébergements, variantes, liens, réservations et documents. Il ne dépend ni de React ni du stockage.

### Import, validation et migration

Cette couche ouvre le paquet non fiable, applique les limites de sécurité, valide les versions et schémas, contrôle les références puis produit le modèle interne. Elle est la seule à connaître les représentations externes.

### Persistance

Les dépôts IndexedDB stockent et récupèrent le contenu et l'état personnel par voyage. Ils gèrent transactions, version de base, migrations de stockage et suppression isolée.

### Hors ligne

Le service worker et sa configuration gèrent le cycle de vie du shell, la stratégie de cache et les mises à jour. Ils ne contiennent pas la logique métier d'un voyage.

### Adaptateurs de plateforme

Des adaptateurs étroits encapsulent les capacités du navigateur : sélection de fichier, téléchargement ou lecture d'un document local, ouverture d'un lien externe et détection de connectivité. Ils appliquent les politiques de sécurité communes.

## Contraintes transversales

- TypeScript strict et contrats explicites aux frontières.
- Tests avec chaque fonctionnalité, en priorité sur les données et les scénarios hors ligne.
- Compatibilité mobile et accessibilité vérifiées en continu.
- Dépendances limitées ; toute dépendance majeure doit répondre à un besoin documenté.
- Les décisions qui modifient ces invariants doivent être consignées avant leur mise en œuvre.
