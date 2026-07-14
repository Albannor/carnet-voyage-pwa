# Import

Ce répertoire porte la frontière de confiance des paquets ZIP : contrôle du fichier, inspection de l'archive avant extraction, validation du manifest et du voyage, vérification des ressources, puis normalisation versionnée vers le modèle interne.

La couche est indépendante de React et de la persistance. Elle ne retourne un paquet exploitable qu'après la réussite de toute la chaîne. Aucun contenu importé n'est exécuté ; `guide-standalone.html` est seulement toléré comme fichier opaque et ignoré.
