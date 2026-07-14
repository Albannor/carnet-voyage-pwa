# Carnet de voyage PWA

Carnet de voyage PWA est une future application web progressive, statique et local-first destinée à conserver et consulter une bibliothèque personnelle de voyages. Elle permettra d'importer des dossiers structurés produits avec ChatGPT, puis d'accéder hors connexion à leur synthèse, à leur programme quotidien et aux informations utiles sur place.

## État du projet

Le dépôt contient actuellement le cadrage du produit, les décisions d'architecture, les règles UX et la référence Madrid. Aucun code applicatif, serveur ou dépendance n'a encore été ajouté.

La prochaine étape prévue est l'initialisation contrôlée du socle React, TypeScript et Vite décrite dans la feuille de route. Cette étape ne fait pas partie du présent état du dépôt.

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
- [Règles UX](docs/UX-RULES.md) : principes d'expérience réutilisables extraits de la référence Madrid.
- [Feuille de route](docs/ROADMAP.md) : étapes de développement courtes, ordonnées et vérifiables.
- [Règles de contribution pour Codex](AGENTS.md) : contraintes permanentes de travail dans ce dépôt.
- [Référence Madrid](references/madrid/README.md) : provenance, rôle et limites du guide HTML de référence.

## Structure actuelle

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GUIDE-FORMAT.md
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

Il n'existe à ce stade ni application exécutable, ni commande d'installation, ni commande de test ou de build. Les commandes de qualité seront documentées lorsqu'elles auront réellement été introduites dans le projet.
