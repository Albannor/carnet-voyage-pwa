# Feuille de route

## Principes d'exécution

Chaque étape doit rester courte, livrer un résultat observable et ajouter les tests correspondant à son risque. Une étape n'est terminée que lorsque sa documentation est à jour et que lint, typecheck, tests et build passent dès que ces commandes existent.

Le périmètre reste celui du MVP défini dans `PRODUCT.md`. Les étapes ci-dessous n'autorisent ni backend, ni synchronisation cloud, ni moteur cartographique hors ligne.

## Étape 0 — Cadrage et références

**Livrable :** documentation produit, architecture, format conceptuel, règles UX, feuille de route, règles de contribution et copie de la référence Madrid.

**Vérification :** responsabilités documentaires distinctes, décisions cohérentes, référence conservée sans devenir une dépendance technique, aucune dépendance ou code applicatif ajouté.

## Étape 1 — Socle applicatif et qualité

**Livrable :** application React, TypeScript et Vite minimale, configuration PWA préparatoire, structure de sources par responsabilités et commandes de lint, typecheck, tests et build.

**Vérification :** page statique minimale accessible sur mobile, quatre commandes de qualité exécutables, aucun backend et aucune donnée de voyage codée dans un composant.

## Étape 2 — Modèle de domaine et premier contrat de données

**Livrable :** modèle interne indépendant de React, premier schéma JSON versionné pour un sous-ensemble représentatif de `voyage.json`, exemples valides et invalides.

**Vérification :** tests des invariants, dates, identifiants, références et variantes ; le format ne contient ni HTML actif ni règle de rendu.

## Étape 3 — Import sécurisé et migrations

**Livrable :** sélection d'un paquet, contrôles de structure et de limites, validation du manifest et du voyage, contrôle des ressources, messages d'erreur et première chaîne de migration.

**Vérification :** fixtures valides, incompatibles et malveillantes ; aucun script exécuté ; un échec ne crée pas de voyage partiel.

## Étape 4 — Persistance et bibliothèque locale

**Livrable :** dépôts IndexedDB, transactions d'import, liste des voyages, ouverture et suppression explicite, isolation du contenu et de l'état personnel.

**Vérification :** persistance après rechargement, coexistence de plusieurs voyages, absence de mélange entre eux, rollback d'un import interrompu et suppression ciblée.

## Étape 5 — Consultation commune

**Livrable :** synthèse, navigation par journées, vue « Aujourd'hui », chronologie, hébergement comme ancre et rendu cohérent du modèle interne.

**Vérification :** scénarios sur plusieurs voyages et dates, navigation clavier et tactile, petits écrans, données facultatives absentes et aucun rendu dépendant du HTML source.

## Étape 6 — Actions contextuelles et variantes

**Livrable :** liens d'itinéraire et d'adresse dans leur contexte, accès aux réservations et documents locaux, modes standard, économe en marche et pluie.

**Vérification :** libellés explicites, indication des actions externes, comportement sans réseau, maintien du contexte lors d'un changement de mode et rejet des URL dangereuses.

## Étape 7 — Checklist et notes locales

**Livrable :** checklist persistante et notes personnelles par voyage, séparées du contenu importé.

**Vérification :** conservation après fermeture, isolation entre voyages, réimport sans perte silencieuse et suppression uniquement avec le voyage concerné.

## Étape 8 — Illustrations

**Livrable :** contrat `voyage.json` `1.3.0`, illustrations locales de voyage, journée et étape, rendu responsive, textes alternatifs, légendes et crédits de provenance.

**Vérification :** compatibilité 1.0.0 à 1.2.0, ressources PNG/JPEG/WebP validées et isolées, aucun chargement d’image distant, révocation des URL d’objet et absence d’emplacement vide pour les anciens voyages.

## Étape 9 — Installation et hors ligne

**Livrable :** Web App Manifest propre à l'application, service worker, cache versionné du shell, démarrage hors ligne et disponibilité locale des ressources importées prévues.

**Vérification :** installation, premier chargement contrôlé, redémarrage sans réseau, mise à jour du shell sans perte de voyages et signalement honnête des services externes indisponibles.

**État :** l’implémentation technique, la recette locale et le workflow GitHub Pages sont prêts. Le déploiement réussi sur l’adresse HTTPS réelle, l’installation depuis Safari et la recette sur un iPhone physique restent nécessaires avant la clôture de l’étape.

## Étape 9 bis — Pièces du voyage

**Livrable :** espace « Pièces » dérivé des documents et réservations du dossier, bande « Pièces du jour », espace de l’étape, fiche pièce en lecture seule, puis pièces ajoutées sur l’appareil (PDF, JPEG, PNG, WebP) avec renommage, suppression confirmée et mode présentation des images.

**Vérification :** rattachements uniquement par identifiants, aucune seconde source de vérité, migration IndexedDB v1 → v2 sans perte, isolation par voyage, suppression avec le voyage, aucune écriture dans le contenu importé, aucune pièce dans le cache du service worker ni dans `dist/`.

**Décision :** le contrat `voyage.json` reste inchangé (option A). Les images de QR code ne sont acceptées que comme pièces ajoutées ; une version 1.4.0 autorisant des documents image dans les dossiers reste à décider séparément.

## Étape 10 — Durcissement du MVP

**Livrable :** revue de sécurité des imports, accessibilité, responsive, performance, gestion des limites de stockage et documentation utilisateur minimale.

**Vérification :** parcours critiques automatisés, audit mobile et clavier, corpus d'imports adversariaux, lint, typecheck, tests et build sans erreur.

## Étape 11 — Préparation de la première version

**Livrable :** critères de réussite du MVP tracés vers des scénarios vérifiés, notes de version et procédure reproductible de construction statique.

**Vérification :** démonstration complète installation → import → consultation → hors ligne → persistance → suppression, sans backend ni dépendance à l'exécution d'un guide importé.

## Après le MVP

Les idées explicitement exclues du MVP ne sont pas présumées acquises. Elles devront faire l'objet d'une nouvelle décision produit et d'une analyse d'architecture avant d'apparaître dans la feuille de route.
