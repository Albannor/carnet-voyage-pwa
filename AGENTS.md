# Règles permanentes de travail

Ce fichier s'applique à l'ensemble du dépôt. Il complète la documentation produit et technique ; en cas d'ambiguïté, préserver les invariants décrits dans `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` et `docs/GUIDE-FORMAT.md`.

## Architecture et périmètre

- Préserver une architecture local-first : le parcours principal doit fonctionner à partir des données stockées sur l'appareil, sans backend dans le MVP.
- Maintenir une séparation stricte entre le code de l'application et les dossiers de voyage importés.
- Considérer tout contenu importé comme non fiable. Ne jamais exécuter de script, de gestionnaire d'événement, de HTML actif ou d'autre code provenant d'un import.
- Valider les données importées avant leur enregistrement et appliquer les migrations de format de manière explicite, testée et traçable.
- Ne pas ajouter de backend, de synchronisation cloud ou de dépendance majeure sans besoin démontré, justification écrite et mise à jour préalable de la documentation d'architecture.
- Ne pas faire dériver le format `voyage.json` du manifest PWA de la référence Madrid.
- Ne pas étendre implicitement le périmètre du MVP. Toute nouvelle capacité produit doit être justifiée et documentée.

## Qualité produit

- Maintenir la compatibilité mobile à chaque changement d'interface : petits écrans, interactions tactiles, textes lisibles et navigation utilisable sans survol.
- Préserver l'accessibilité : HTML sémantique, navigation au clavier, focus visible, libellés explicites et contrastes suffisants.
- Ajouter ou adapter des tests avec chaque fonctionnalité et chaque correction de régression.
- Tester en priorité les invariants sensibles : validation des imports, migrations, isolation des voyages, persistance locale et disponibilité hors ligne.
- Conserver un comportement explicite lorsque le réseau manque ; les liens externes ne doivent jamais être présentés comme disponibles hors ligne.

## Documentation et décisions

- Documenter toute décision d'architecture qui modifie les responsabilités des couches, le stockage, la sécurité, le format d'import ou la stratégie hors ligne.
- Maintenir la cohérence entre le README, la documentation produit, l'architecture, le format des guides, les règles UX et la feuille de route.
- Traiter `references/` comme un ensemble de sources en lecture seule. Une référence peut inspirer le produit, mais ne définit ni son architecture ni son contrat de données.

## Vérifications

- Lorsque les commandes correspondantes existeront, exécuter avant livraison : lint, typecheck, tests et build.
- Ne pas annoncer une vérification qui n'a pas été exécutée. Signaler clairement toute commande absente, non lancée ou en échec.
- Vérifier qu'aucune dépendance, sortie de build, donnée personnelle ou ressource hors périmètre n'est ajoutée accidentellement.

## Git

- Ne jamais créer de commit ou effectuer de push automatiquement.
- Ne pas changer de branche et ne pas créer de worktree sans demande explicite.
- Préserver les changements préexistants de l'utilisateur et limiter chaque diff au périmètre demandé.
