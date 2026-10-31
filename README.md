# Carnet de voyage PWA

Carnet de voyage PWA est une application web progressive en construction, statique et local-first, destinée à conserver et consulter une bibliothèque personnelle de voyages. Elle importe des dossiers structurés produits avec ChatGPT puis rend leur contenu dans une interface commune contrôlée par l’application.

## État du projet

L’étape 9 est implémentée techniquement : le build de production génère un manifeste installable, un service worker Workbox et un cache versionné du shell. Un workflow GitHub Actions prépare son déploiement statique sur GitHub Pages à l’adresse attendue `https://albannor.github.io/carnet-voyage-pwa/`. Les voyages, illustrations, PDF, checklists et notes restent dans IndexedDB sur chaque appareil et ne font pas partie du site publié. Le déploiement HTTPS effectif et la recette sur un iPhone réel restent à confirmer avant de considérer l’étape comme entièrement validée ; le projet ne passe donc pas encore à l’étape 10.

## Prérequis

- Node.js `^20.19.0` ou `>=22.12.0` ;
- npm, fourni avec Node.js.

## Installation

Depuis la racine du dépôt :

```bash
npm install
```

Cette commande installe les versions verrouillées dans `package-lock.json`.

## Lancement local

```bash
npm run dev
```

Vite affiche l'adresse locale à ouvrir dans un navigateur. Le serveur lancé par cette commande sert uniquement au développement de l'application statique ; il ne constitue pas un backend.

Pour prévisualiser le build de production après `npm run build` :

```bash
npm run preview
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` construit et vérifie l’application lors d’un push sur `main` ou d’un déclenchement manuel, puis téléverse uniquement `dist/` vers l’environnement `github-pages`. La source Pages du dépôt doit être réglée sur **GitHub Actions**. Le workflow `.github/workflows/ci.yml` exécute les mêmes contrôles et un audit des dépendances d’exécution sur chaque pull request, sans déployer.

Le shell publié est public, y compris lorsque le dépôt source est privé. Il ne contient aucun voyage personnel : les voyages importés, images, PDF, checklists et notes sont créés ou conservés dans IndexedDB, localement sur chaque appareil. L’exécution et le résultat d’un déploiement se contrôlent dans l’onglet **Actions** du dépôt, dans le workflow **Deploy application to GitHub Pages**.

## Commandes de vérification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- `lint` contrôle les fichiers TypeScript et React avec ESLint.
- `typecheck` vérifie les contrats TypeScript sans produire de fichiers.
- `test` exécute les tests Vitest une fois.
- `build` vérifie TypeScript, produit l'application statique dans `dist/`, puis contrôle le manifeste, les icônes, les chemins relatifs et le précache généré.

## Principes directeurs

- L'application fonctionne sans backend dans le MVP et conserve les voyages sur l'appareil.
- Le stockage métier repose sur IndexedDB ; le service worker et Cache Storage ne conservent que le shell applicatif versionné.
- L'application et les dossiers de voyage restent strictement séparés : un voyage importé est une donnée, jamais du code.
- Chaque import est structuré, versionné et validé avant toute écriture locale.
- Aucun script ou HTML actif provenant d'un guide importé n'est exécuté par l'application.
- L'interface reste cohérente, lisible sur mobile et indépendante de la présentation du dossier source.
- Les services externes, notamment les cartes, sont ouverts au moyen de liens explicites.

## Documentation

- [Produit](docs/PRODUCT.md) : vision, utilisateurs, périmètre du MVP et critères de réussite.
- [Architecture](docs/ARCHITECTURE.md) : modèle local-first, sécurité, stockage, hors ligne et futures couches techniques.
- [Format des guides](docs/GUIDE-FORMAT.md) : structure conceptuelle du paquet de voyage et règles de versionnement.
- [Contrat `voyage.json` 1.0.0](contracts/voyage/1.0.0/README.md) : contrat initial toujours pris en charge.
- [Contrat `voyage.json` 1.1.0](contracts/voyage/1.1.0/README.md) : documents, réservations et associations contextuelles optionnelles.
- [Contrat `voyage.json` 1.2.0](contracts/voyage/1.2.0/README.md) : définitions de checklists ciblant le voyage, une journée ou une étape.
- [Contrat `voyage.json` 1.3.0](contracts/voyage/1.3.0/README.md) : illustrations locales, associations explicites et provenances.
- [Import sécurisé](docs/IMPORT.md) : format ZIP, manifest, ressources, limites, erreurs et normalisation.
- [Persistance locale](docs/PERSISTENCE.md) : base IndexedDB, object stores, transactions, isolation et erreurs.
- [Consultation](docs/CONSULTATION.md) : quatre sections de consultation, vue « Aujourd’hui », programme chronologique, pièces du voyage avec hébergements et lieux utiles, et préparation.
- [Installation et hors ligne](docs/OFFLINE.md) : installation, cache du shell, mises à jour, recette locale et procédure iPhone.
- [Outils de la Fabrique](tools/fabrique/README.md) : production et validation hors application des paquets ZIP importables, images Wikimedia Commons comprises.
- [Règles UX](docs/UX-RULES.md) : principes d'expérience réutilisables extraits de la référence Madrid.
- [Feuille de route](docs/ROADMAP.md) : étapes de développement courtes, ordonnées et vérifiables.
- [Règles de contribution pour Codex](AGENTS.md) : contraintes permanentes de travail dans ce dépôt.
- [Référence Madrid](references/madrid/README.md) : provenance, rôle et limites du guide HTML de référence.

## Structure applicative

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-pages.yml
├── .gitignore
├── AGENTS.md
├── README.md
├── contracts/
│   ├── package/1.0.0/  # schéma versionné de manifest.json
│   └── voyage/          # schémas JSON de contenu 1.0.0 à 1.3.0
├── examples/
│   └── voyage/          # exemples valides et invalides par version
├── index.html
├── package-lock.json
├── package.json
├── public/
│   ├── favicon.png
│   └── icons/           # SVG source et icônes PNG PWA/iOS
├── scripts/
│   └── verify-pwa-build.mjs
├── src/
│   ├── application/     # cas d'usage entre import, persistance et interface
│   ├── contracts/       # types externes, validation du schéma et conversion
│   ├── domain/          # modèle métier et invariants indépendants de React
│   ├── import/          # lecture ZIP, sécurité, ressources et migrations
│   ├── persistence/     # dépôt IndexedDB, modèles stockés et erreurs
│   ├── services/        # adaptateurs navigateur, connectivité et cycle PWA
│   ├── test/            # configuration commune des tests
│   ├── ui/              # interface React, styles et tests de rendu
│   └── main.tsx         # point de composition de l'application
├── eslint.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONSULTATION.md
│   ├── GUIDE-FORMAT.md
│   ├── IMPORT.md
│   ├── OFFLINE.md
│   ├── PERSISTENCE.md
│   ├── PRODUCT.md
│   ├── ROADMAP.md
│   └── UX-RULES.md
└── references/
    └── madrid/
        ├── Guide_Madrid_Interactif_standalone.html
        └── README.md
```

## Référence Madrid

Le guide Madrid est l'unique référence UX et éditoriale initiale. Il illustre une synthèse opérationnelle, un déroulement chronologique, une navigation par journée, des variantes de visite, des liens contextuels, des checklists et des notes locales.

Son code n'est ni un socle technique ni un format d'import. Le fichier est conservé tel quel à des fins d'analyse et ne doit pas être embarqué ou exécuté par la future application.

## Limites actuelles

Les contrats `voyage.json` `1.0.0` à `1.3.0` restent des sous-ensembles versionnés, pas le format définitif complet. Une seule note personnelle en texte brut est disponible par voyage ; il n’existe ni note riche, ni pièce jointe, ni fusion de réimport. Les actions externes nécessitent un réseau et aucun lecteur PDF, carrousel ou moteur cartographique n'est intégré. Le premier chargement du shell exige une connexion et l’implémentation PWA doit encore être validée depuis une adresse HTTPS réelle et sur iPhone. La recherche de photographies et la génération des futurs paquets relèvent du processus de génération externe, qui sera mis à jour séparément.
