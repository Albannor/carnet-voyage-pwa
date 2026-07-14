# Règles UX

## Objet du document

Ces règles traduisent en principes réutilisables les qualités fonctionnelles et visuelles observées dans le guide Madrid. Elles ne reprennent pas son contenu touristique et ne prescrivent pas son code, ses styles ou sa structure HTML.

## Hiérarchie de consultation

### Commencer par l'opérationnel

La première vue d'un voyage donne immédiatement :

- la destination et les dates ;
- le contexte essentiel du séjour ;
- l'hébergement ou le point d'ancrage principal ;
- le rythme et les contraintes importantes ;
- un accès direct à la journée pertinente.

La synthèse aide à décider et à agir. Elle évite de reproduire tout le programme ou d'accumuler des informations secondaires.

### Organiser le voyage par journées

Chaque journée constitue une unité de navigation identifiable par sa date et son intention principale. L'utilisateur peut passer directement de la synthèse à une journée et naviguer entre les jours sans revenir au début.

La vue « Aujourd'hui » sélectionne la journée correspondant à la date locale du voyage. Si aucune journée ne correspond, elle explique la situation et laisse les journées accessibles sans inventer de programme.

### Montrer le déroulement dans le temps

Le détail d'une journée suit un ordre chronologique. Les heures, étapes, transitions et marges importantes sont visuellement distinctes. Les arbitrages et règles de sécurité horaire apparaissent près du moment concerné.

Une frise peut soutenir la lecture, mais le sens ne doit jamais dépendre seulement d'une ligne, d'une couleur ou d'une image.

## Contexte et actions

### Utiliser l'hébergement comme ancre

L'hébergement sert de repère logistique lorsque le programme part de ce lieu, y revient ou nécessite une décision de transport. Son adresse et ses actions utiles restent faciles à retrouver depuis la synthèse et les journées concernées.

Si un voyage comporte plusieurs hébergements, l'ancre affichée est celle qui correspond à la date et au contexte, sans supposer un hôtel unique.

### Placer les itinéraires au point d'usage

Un lien d'itinéraire apparaît auprès de l'étape ou du groupe d'étapes qu'il dessert. Son libellé décrit la destination ou le trajet ; il ne se limite pas à « Ouvrir ».

L'interface indique qu'il s'agit d'un service externe et qu'une connexion peut être nécessaire. Une liste pratique peut regrouper les adresses, mais ne remplace pas les actions contextuelles.

### Rapprocher documents et réservations de l'action

Une réservation ou un document est accessible depuis la journée, l'étape ou le lieu auquel il se rapporte. Une vue récapitulative peut compléter cet accès sans créer une seconde source de vérité.

### Rendre les actions prioritaires évidentes

Les actions principales sont peu nombreuses, clairement libellées et visuellement différenciées des informations. Copier une adresse, ouvrir un trajet ou consulter un document doit produire un retour immédiat compréhensible.

## Variantes et plans B

Le programme standard est le point de départ. Les variantes « économe en marche » et « pluie » modifient ou complètent le conseil sans dupliquer toute la journée.

Les règles sont :

- afficher le mode actif sans dépendre uniquement de la couleur ;
- conserver le contexte de la journée lors du changement de mode ;
- montrer uniquement les adaptations réellement fournies par le dossier ;
- ne pas masquer une contrainte critique lorsqu'un autre mode est sélectionné ;
- conserver localement le dernier mode choisi lorsque cela aide la consultation.

Un plan B est une alternative concrète rattachée à une étape ou une période, pas une rubrique générique sans contexte.

## Persistance locale visible

Les checklists et notes donnent un retour immédiat et conservent leur état sur l'appareil. Leur portée est explicite : un état appartient à un voyage et ne doit pas apparaître dans un autre.

L'interface doit :

- distinguer le contenu importé des annotations personnelles ;
- enregistrer sans demander une action technique supplémentaire ;
- communiquer clairement que les données restent locales dans le MVP ;
- éviter toute perte silencieuse lors d'une réimportation ou d'une mise à jour ;
- demander une action explicite avant une suppression irréversible.

## Navigation mobile

Le téléphone est le support prioritaire pendant le voyage.

- La navigation principale reste disponible sans occuper une part excessive de l'écran.
- Les onglets de journées peuvent défiler horizontalement lorsque l'espace manque et gardent un libellé lisible.
- Les colonnes deviennent une lecture verticale cohérente sur petit écran.
- Les cibles tactiles sont suffisamment grandes et espacées.
- Aucun contenu ou contrôle essentiel ne dépend du survol.
- Les textes, tableaux, chronologies, liens et documents ne provoquent pas de défilement horizontal subi.
- La position de lecture et le choix de journée résistent autant que possible aux retours depuis un service externe.

## Lisibilité et qualité visuelle

L'aspect professionnel du guide Madrid provient d'une hiérarchie stable plus que d'une décoration spécifique. L'application doit conserver :

- une typographie lisible et une largeur de ligne maîtrisée ;
- des niveaux de titres prévisibles ;
- des cartes et regroupements réservés aux unités de sens ;
- une palette sobre avec contrastes suffisants ;
- un espacement régulier et une densité compatible avec l'usage en mouvement ;
- des images d'illustration subordonnées à l'information ;
- des états actifs, focus, erreur, hors ligne et indisponible clairement distincts.

Le thème éventuel ne doit pas varier selon le voyage au point d'altérer la cohérence ou l'accessibilité de l'application.

## Accessibilité et robustesse

- Utiliser une structure sémantique et un ordre de lecture logique.
- Associer chaque contrôle à un nom explicite et exposer son état aux technologies d'assistance.
- Permettre la navigation au clavier et conserver un focus visible.
- Ne jamais coder une information uniquement par la couleur, la position ou l'image.
- Fournir un texte alternatif utile aux images informatives et ignorer celles qui sont purement décoratives.
- Respecter les préférences de réduction des animations si des transitions sont ajoutées.
- Garder les informations essentielles lisibles lorsque les images manquent ou que le réseau est indisponible.

## Confiance et hors ligne

L'utilisateur doit savoir ce qui est disponible localement et ce qui dépend d'un tiers.

- Un voyage importé et validé ne change pas de présentation de manière imprévisible.
- Une action externe est annoncée avant de quitter l'application.
- Une ressource non disponible hors ligne produit une explication et laisse le reste du voyage utilisable.
- Les erreurs d'import nomment le problème et, lorsque possible, l'élément concerné.
- Aucun contenu importé ne peut introduire une interface trompeuse, un script ou un contrôle actif.

## Éléments de la référence à ne pas généraliser

Les choix propres au séjour Madrid — destination, hôtel, personnes, dates, horaires, lieux, parcours, photographies, QR codes et préférences touristiques — ne sont pas des règles produit.

De même, `localStorage`, les fonctions JavaScript, la feuille de styles, le découpage exact des cartes et le manifest PWA éventuel du guide ne sont pas des références d'architecture. Seuls les principes d'usage décrits ci-dessus sont réutilisés.
