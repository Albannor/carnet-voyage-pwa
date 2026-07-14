# Domaine

Le répertoire `voyage/` contient le premier modèle métier interne et ses validations sémantiques. Il représente les voyages, périodes, lieux, hébergements, journées, étapes, liens et variantes avec des identifiants stables et des références explicites.

Le domaine reste indépendant de React, des composants d'interface, du contrat JSON externe et de la persistance. La conversion depuis `voyage.json` appartient à `src/contracts/`, tandis que l'enchaînement des validations appartient à `src/application/`.
