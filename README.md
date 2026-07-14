# Carnet de voyage PWA

Carnet de voyage PWA est une future application web progressive, statique et local-first destinée à conserver et consulter une bibliothèque personnelle de voyages. Elle permettra d'importer des dossiers structurés produits avec ChatGPT, puis d'accéder hors connexion à leur synthèse, à leur programme quotidien et aux informations utiles sur place.

## État du projet

Le dépôt contient désormais une démonstration de l'import sécurisé de l'étape 3. L'application peut sélectionner un paquet ZIP, contrôler sa structure, valider son manifest et `voyage.json`, vérifier ses ressources puis produire le modèle interne normalisé. Le résultat reste uniquement en mémoire : aucun stockage local ou écran de consultation n'est encore implémenté.

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
- `build` vérifie TypeScript puis produit l'application statique dans `dist/`.

## Principes directeurs

- L'application fonctionne sans backend dans le MVP et conserve les voyages sur l'appareil.
- Le stockage métier reposera sur IndexedDB ; le service worker et le Cache Storage assureront la disponibilité hors ligne de l'application.
- L'application et les dossiers de voyage restent strictement séparés : un voyage importé est une donnée, jamais du code.
- Chaque import est structuré, versionné et validé avant toute écriture locale.
- Aucun script ou HTML actif provenant d'un guide importé n'est exécuté par l'application.
- L'interface reste cohérente, lisible sur mobile et indépendante de la présentation du dossier source.
- Les services externes, notamment les cartes, sont ouverts au moyen de liens explicites.

## Documentation

- [Produit](docs/PRODUCT.md) : vision, utilisateurs, périmètre du MVP et critères de réussite.
- [Architecture](docs/ARCHITECTURE.md) : modèle local-first, sécurité, stockage, hors ligne et futures couches techniques.
- [Format des guides](docs/GUIDE-FORMAT.md) : structure conceptuelle du paquet de voyage et règles de versionnement.
- [Contrat `voyage.json` 1.0.0](contracts/voyage/1.0.0/README.md) : périmètre, formats, politiques de validation et limites du premier sous-ensemble.
- [Import sécurisé](docs/IMPORT.md) : format ZIP, manifest, ressources, limites, erreurs et normalisation.
- [Règles UX](docs/UX-RULES.md) : principes d'expérience réutilisables extraits de la référence Madrid.
- [Feuille de route](docs/ROADMAP.md) : étapes de développement courtes, ordonnées et vérifiables.
- [Règles de contribution pour Codex](AGENTS.md) : contraintes permanentes de travail dans ce dépôt.
- [Référence Madrid](references/madrid/README.md) : provenance, rôle et limites du guide HTML de référence.

## Structure applicative

```text
.
├── .gitignore
├── AGENTS.md
├── README.md
├── contracts/
│   ├── package/1.0.0/  # schéma versionné de manifest.json
│   └── voyage/1.0.0/   # schéma JSON versionné du contenu
├── examples/
│   └── voyage/1.0.0/   # exemple valide et fixtures invalides
├── index.html
├── package-lock.json
├── package.json
├── public/
│   ├── icons/
│   │   └── carnet.svg
│   └── manifest.webmanifest
├── src/
│   ├── application/     # orchestration de validation en mémoire
│   ├── contracts/       # types externes, validation du schéma et conversion
│   ├── domain/          # modèle métier et invariants indépendants de React
│   ├── import/          # lecture ZIP, sécurité, ressources et migrations
│   ├── persistence/     # futurs dépôts de stockage local
│   ├── services/        # futurs adaptateurs techniques et hors ligne
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
│   ├── GUIDE-FORMAT.md
│   ├── IMPORT.md
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

Les contrats `1.0.0` restent de premiers sous-ensembles, pas le format définitif complet. L'import ne persiste rien : IndexedDB, bibliothèque de voyages et transactions appartiennent à l'étape 4. Réservations, associations de documents aux entités, checklist, notes et rendu détaillé du voyage restent absents. Le manifest web prépare l'identité installable de l'application, mais aucun service worker ou comportement hors ligne supplémentaire n'est implémenté.
