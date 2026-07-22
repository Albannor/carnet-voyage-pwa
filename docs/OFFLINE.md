# Installation et fonctionnement hors ligne

## Responsabilités locales

Le build de production est une PWA statique. `vite-plugin-pwa` `1.3.0` et Workbox génèrent le manifeste, le service worker et le précache du shell. Cette dépendance est limitée au build et au cycle de mise à jour du shell ; elle ne remplace ni la chaîne d’import ni le dépôt IndexedDB.

Les deux stockages du navigateur restent strictement séparés :

- **Cache Storage** reçoit uniquement le shell versionné : `index.html`, JavaScript, CSS, manifeste, favicon et icônes ;
- **IndexedDB** reste la source de vérité pour les voyages normalisés, illustrations, PDF, checklists et notes.

Le service worker ne contient aucune logique d’import, n’accède pas à IndexedDB et ne duplique pas les ressources d’un voyage. Les images et PDF importés sont toujours relus avec la clé du voyage courant, puis exposés temporairement par une URL d’objet révoquée par l’application.

## Premier chargement et installation

Le premier chargement doit réussir en ligne afin que le navigateur télécharge le shell et termine l’installation du service worker. Le mode hors ligne n’est pas promis avant l’apparition du message « Prêt hors ligne ».

Un hébergement de production doit servir le dossier `dist/` en HTTPS. Les chemins du build sont relatifs : le même résultat peut être publié à la racine d’un domaine ou sous un répertoire, sans URL de production codée dans le dépôt.

Sur iPhone, la procédure prévue est :

1. ouvrir l’adresse HTTPS dans Safari ;
2. utiliser **Partager** ;
3. choisir **Sur l’écran d’accueil** ;
4. ouvrir l’application installée.

Cette procédure est documentée mais n’a pas encore été validée sur un iPhone réel.

## Cache et navigation

Workbox précache une révision cohérente des fichiers du shell. Une navigation dans le périmètre de l’application peut recevoir `index.html` depuis ce précache. `guide-standalone.html` est exclu de cette navigation de secours et ne fait jamais partie du précache.

Aucune stratégie de cache à l’exécution n’est définie pour :

- les cartes, itinéraires et services HTTPS externes ;
- les URL contenues dans les voyages ;
- les images ou documents importés ;
- les contenus tiers.

Lorsqu’un nouveau shell est téléchargé, il reste en attente. L’application affiche « Mise à jour disponible » ; le bouton **Recharger maintenant** active cette version et recharge la page. **Plus tard** laisse l’utilisateur terminer son interaction. Workbox nettoie les précaches obsolètes lors de l’activation, sans modifier IndexedDB.

## Connectivité et services externes

L’adaptateur de connectivité observe `navigator.onLine` et les événements `online` et `offline`. Lorsque le navigateur signale une absence de réseau, l’application rappelle que les contenus locaux restent disponibles et neutralise les actions externes avec un libellé accessible.

Inversement, `navigator.onLine === true` signifie seulement qu’une interface réseau est disponible. Les cartes, itinéraires et autres services restent toujours présentés comme externes et dépendants d’une connexion ; l’application ne garantit pas leur joignabilité.

## Recette manuelle locale

Après `npm run build` :

1. lancer `npm run preview -- --host 127.0.0.1` ;
2. ouvrir l’adresse locale affichée dans un navigateur compatible avec les service workers ;
3. attendre le message « Prêt hors ligne », puis recharger une fois si le navigateur vient d’installer son premier contrôleur ;
4. importer un paquet de test, ouvrir un voyage, une illustration et un PDF local, cocher un élément et enregistrer la note ;
5. couper le réseau avec les outils du navigateur ou arrêter le serveur après la mise en cache ;
6. recharger l’application et vérifier que le shell, le voyage et ses ressources locales restent accessibles ;
7. vérifier que les liens externes sont signalés comme indisponibles lorsque le navigateur émet l’état hors connexion ;
8. republier un build modifié, vérifier que l’information de mise à jour apparaît, l’appliquer volontairement puis confirmer que les données IndexedDB sont intactes.

`npm run build` exécute aussi `scripts/verify-pwa-build.mjs`. Ce contrôle vérifie les fichiers attendus, les dimensions et signatures PNG, les champs essentiels du manifeste, les chemins relatifs, l’inventaire de précache et l’absence de manipulation IndexedDB dans le service worker généré. `dist/` reste ignoré par Git.

## Validation restante

L’implémentation est prête pour une publication statique. Restent à effectuer hors de cette tâche :

- choisir et configurer un hébergement HTTPS ;
- publier `dist/` ;
- exécuter la recette avec l’adresse réelle ;
- installer l’application depuis Safari et valider le redémarrage hors ligne sur un iPhone physique ;
- vérifier le cycle de mise à jour après une seconde publication.
