# Produit

## Objet du document

Ce document définit ce que doit accomplir Carnet de voyage PWA et délimite son MVP. Les choix techniques relèvent de `ARCHITECTURE.md`, la forme des dossiers importés de `GUIDE-FORMAT.md` et les conventions d'interface de `UX-RULES.md`.

## Vision

Carnet de voyage PWA est un carnet personnel qui transforme des dossiers de voyage structurés en une expérience de consultation stable, rapide et exploitable sur place. L'utilisateur conserve plusieurs voyages sur son appareil et retrouve la même interface quel que soit le contenu généré en amont avec ChatGPT.

Le produit privilégie l'utilité immédiate : comprendre la journée, savoir où aller, retrouver une adresse ou une réservation et choisir un plan de repli avec le moins de friction possible. Une fois l'application installée et le voyage importé, les informations essentielles doivent rester disponibles sans connexion.

## Utilisateurs

Le MVP s'adresse à une personne ou à un petit groupe qui :

- prépare ses voyages avec ChatGPT sous la forme d'un dossier structuré ;
- veut conserver plusieurs voyages dans une bibliothèque privée sur un appareil ;
- consulte principalement son téléphone avant et pendant le séjour ;
- souhaite garder la maîtrise de ses données sans créer de compte ;
- accepte d'ouvrir ponctuellement un service externe pour une carte, un itinéraire ou une autre ressource en ligne.

Le produit ne suppose ni rôle administrateur, ni collaboration en temps réel, ni partage de compte.

## Usages avant le voyage

- Importer un dossier de voyage structuré et recevoir un résultat clair en cas de validité ou d'erreur.
- Identifier le voyage par sa destination, ses dates et ses informations principales.
- Parcourir une synthèse et le programme de chaque journée.
- Retrouver les hébergements, adresses, réservations, documents et alternatives préparés dans le dossier.
- Consulter les illustrations locales et leurs crédits sans dépendre d’une source distante.
- Compléter une checklist et ajouter des notes personnelles conservées localement.
- Vérifier que le voyage sera consultable hors connexion après installation et import.

## Usages pendant le voyage

- Ouvrir rapidement le voyage en cours depuis la bibliothèque.
- Accéder à une vue « Aujourd'hui » centrée sur la date locale du voyage, tout en gardant la navigation vers les autres journées.
- Suivre le déroulement chronologique, distinguer les étapes importantes et repérer les marges ou arbitrages.
- Utiliser l'hôtel ou l'hébergement pertinent comme point d'ancrage logistique.
- Ouvrir un itinéraire, une adresse, une réservation ou un document depuis le contexte où il est utile.
- Basculer entre le programme standard et les variantes prévues, notamment une option économe en marche ou une option pluie.
- Cocher des éléments et consulter ou modifier ses notes sans perdre leur état après fermeture de l'application.
- Consulter les données essentielles même en l'absence de réseau, avec une indication honnête pour les ressources externes indisponibles.

## Périmètre du MVP

Le MVP comprend :

- une PWA statique installable, réalisée avec React, TypeScript et Vite ;
- une bibliothèque locale de voyages avec import, consultation et suppression explicite ;
- l'import d'un paquet structuré et versionné, puis la validation de ses données contre un schéma JSON ;
- le stockage local des voyages, des états de checklist et des notes ;
- une synthèse du voyage, une navigation par journée et une vue « Aujourd'hui » ;
- une présentation chronologique des étapes d'une journée ;
- l'accès contextuel aux hébergements, lieux, itinéraires, réservations, documents et plans B fournis par le dossier ;
- les modes standard, économe en marche et pluie lorsqu'ils sont décrits dans le voyage ;
- les illustrations locales de couverture, journée et étape avec texte alternatif, légende et provenance ;
- une interface mobile cohérente pour tous les voyages ;
- la disponibilité hors ligne de l'application et des contenus locaux après leur installation ou import ;
- l'ouverture explicite des services externes par des liens.

## Exclusions du MVP

Le MVP ne comprend pas :

- de compte utilisateur, d'authentification ou de gestion de profils ;
- de backend, d'API métier hébergée ou de base de données distante ;
- de synchronisation cloud, multiappareil ou collaborative ;
- de génération de voyage par ChatGPT depuis l'application ;
- d'édition complète du dossier de voyage ou de son programme structuré dans l'application ;
- de moteur cartographique hors ligne complet, de guidage GPS ou de calcul d'itinéraire interne ;
- d'exécution ou d'intégration active du HTML, du JavaScript ou d'autres codes contenus dans un dossier importé ;
- de reprise de l'architecture, du stockage ou du manifest PWA du guide Madrid ;
- de fonctionnalité sociale, de réservation ou de paiement intégré.

## Critères de réussite du MVP

Le MVP est considéré comme réussi lorsque :

- un utilisateur peut installer l'application, importer un dossier valide et retrouver le voyage après fermeture ou redémarrage ;
- un dossier invalide, incompatible ou malveillant est refusé sans exécution de code et avec un message exploitable ;
- plusieurs voyages peuvent coexister localement sans mélange de contenu, de checklist ou de notes ;
- la synthèse, les journées et la vue « Aujourd'hui » permettent d'atteindre les informations essentielles en quelques actions sur mobile ;
- les étapes, liens, documents et variantes apparaissent dans leur contexte et restent compréhensibles sans connaître la structure du fichier source ;
- les illustrations restent locales, créditées et non indispensables à la compréhension du contenu ;
- l'application et les contenus importés prévus pour l'usage local restent consultables hors connexion ;
- les états de checklist et les notes persistent séparément du contenu importé ;
- l'interface reste utilisable sur les tailles d'écran mobiles prises en charge et répond aux contrôles d'accessibilité définis pour le projet ;
- les scénarios critiques d'import, de migration, de persistance et de hors-ligne sont couverts par des tests ;
- lint, typecheck, tests et build passent dans l'environnement de référence lorsque ces commandes auront été mises en place.
