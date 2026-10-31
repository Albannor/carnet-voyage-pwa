# Consultation des voyages

## Périmètre

La consultation commune de l’étape 5 rend exclusivement le modèle métier normalisé relu depuis IndexedDB. Elle ne lit pas l’archive ZIP, ne reconstruit rien depuis `guide-standalone.html` et n’interprète aucun HTML importé. Tous les textes du voyage sont rendus comme du texte par React.

Le parcours de consultation est structuré autour de cinq sections :

```text
Bibliothèque
  └─ Aperçu
  └─ Programme → journée / Aujourd’hui
  └─ Pièces
  └─ Pratique
  └─ Préparation
```

Ces cinq sections sont accessibles depuis une barre de navigation fixée en bas de l’écran, chaque entrée associant une icône et un libellé ; la section active est signalée par `aria-current` et par une pastille, jamais par la seule couleur. La barre respecte les marges de sécurité des écrans à encoche (`env(safe-area-inset-*)`). Le retour à la bibliothèque est un bouton rond nommé « Retour à la bibliothèque », posé sur la couverture dans l’Aperçu et dans la barre de titre des autres sections. Changer de section ramène le haut de la section à l’écran. Sur les écrans de moins de 24 rem, les libellés passent à 11 px et peuvent se couper (césure française) plutôt que déborder.

L’**Aperçu** reste volontairement concis : couverture éventuelle en pleine largeur, titre, destination, dates et durée, résumé, puis un encart temporel qui dépend de la date du jour (« Départ dans N jours », « Aujourd’hui » ou « Voyage terminé ») et mène au programme pertinent. Suivent la liste des journées, l’hébergement correspondant à la date de référence avec la copie de son adresse — l’adresse complète restant affichée dans Pratique — et les réservations datées à retenir. Le **Programme** porte la navigation par journées et le déroulé chronologique. **Pièces** offre une vue récapitulative des documents et réservations du dossier, décrite plus bas. **Pratique** centralise les hébergements, lieux, réservations, documents et crédits photographiques. La **Préparation** regroupe les checklists par cible, les réservations à confirmer et la note personnelle.

## Navigation et rechargement

L’état de consultation distingue la bibliothèque, le chargement, l’erreur de lecture et le voyage prêt à être affiché. La vue active est l’une des suivantes :

- `summary` pour la synthèse ;
- `today` pour « Aujourd’hui » ;
- `day` avec un identifiant stable de journée ;
- `step` avec un identifiant stable d’étape, pour l’espace de l’étape ;
- `pieces` pour l’espace Pièces ;
- `piece` avec l’identifiant d’un document, d’une réservation ou d’une pièce ajoutée, pour la fiche d’une pièce ;
- `add-piece`, avec éventuellement la journée ou l’étape à présélectionner, pour l’ajout d’une pièce ;
- `practical` pour la section Pratique ;
- `preparation` pour les checklists, confirmations et notes.

L’identifiant du voyage et cette vue sont reflétés dans les paramètres `travel`, `view`, `day`, `step`, `document`, `reservation` et `added` de l’URL. Ils ne constituent pas des données métier et ne contiennent aucun contenu du voyage. Après un rechargement, l’application relit le voyage correspondant dans IndexedDB. Un identifiant absent ou une erreur de lecture produit un état explicite avec un retour vers la bibliothèque. Aucun état métier n’est écrit dans `localStorage`.

## Vue « Aujourd’hui » et fuseau horaire

La date courante est calculée à partir d’une horloge injectable et du fuseau IANA déclaré par le voyage. Les tests ne dépendent donc jamais de l’heure de la machine.

La vue applique quatre états déterministes :

1. une journée porte la date locale du voyage : son programme est affiché ;
2. la date précède le séjour : la date de début est rappelée ;
3. la date suit le séjour : la date de fin est rappelée ;
4. la date appartient au séjour sans journée correspondante : cette absence est expliquée sans inventer de programme.

Dans tous les cas, les journées existantes restent accessibles. Les changements de jour à minuit dans le fuseau du voyage et les différences entre plusieurs fuseaux sont couverts par des tests avec une horloge fixe.

## Chronologie

Les étapes sont rendues dans l’ordre du tableau du modèle interne, déjà contrôlé par les invariants métier lors de l’import. L’interface ne déduit pas l’ordre d’une présentation source et ne réordonne pas visuellement le contenu.

Les étapes forment une frise : une pastille par étape sur un fil vertical, puis une carte avec l’heure, le titre, le lieu et les actions utiles. Toucher la zone horaire, titre et lieu ouvre l’espace de l’étape : un bouton natif « Ouvrir l’étape … », signalé par un chevron, couvre cette zone sans englober les liens, documents et réservations de la carte, qui restent des actions distinctes.

Lorsque la journée affichée est celle du jour dans le fuseau du voyage, la frise situe chaque étape par rapport à l’heure locale. Une étape est passée lorsque sa fin — son heure de fin, sinon le début de l’étape horodatée suivante — est atteinte ; elle reçoit une pastille cochée et la mention accessible « Étape passée ». La première étape non passée est mise en avant sur fond soleil clair avec la mention « En cours » si elle a commencé, « Prochaine étape » sinon. Cette progression se met à jour chaque minute tant que la journée reste affichée. Une journée sans aucun horaire ne reçoit aucune mise en avant, et les autres journées restent neutres.

Une étape sans heure reste à sa position normalisée et porte la mention « Sans horaire ». Aucune heure, durée ou contrainte absente du contrat n’est inventée. Les lieux sont résolus par leur identifiant stable. Dans le programme, leur libellé sert de repère et leurs liens utiles restent accessibles au point d’usage. Les infos pratiques offrent en complément un index global des mêmes lieux et liens ; elles ne constituent pas une seconde source de données et ne sont jamais le seul accès à une action utile au programme.

## Hébergements et informations pratiques

Chaque hébergement possède une fiche unique dans les infos pratiques. La fiche résout son lieu par `placeId` et les réservations ou documents associés uniquement depuis les `reservationIds` et `documentIds` des étapes qui portent explicitement son `accommodationId`. Aucun rapprochement n’est déduit d’un libellé, d’un chemin ou d’un nom de fichier.

Dans le programme, l’en-tête de chaque journée rappelle l’hébergement qui couvre sa date comme point de départ (« Hébergement » le jour de son arrivée, « Départ » les autres jours), avec un bouton de copie de l’adresse. Une étape liée à un hébergement conserve son titre éditorial et un lien discret vers Pratique. L’adresse, les liens externes, la réservation et les documents ne sont pas répétés dans chaque journée. Les anciens voyages sans hébergement restent consultables sans section vide.

## Actions contextuelles et documents

Les actions sont distinguées par leur libellé, leur comportement et une apparence propre à chaque type, afin qu’elles ne soient jamais interchangeables :

- un **lien pratique ordinaire** conserve le libellé éditorial importé et apparaît comme un texte souligné suivi d’une icône de sortie, auprès de l’étape ;
- une **copie d’adresse** est un bouton compact à contour avec une icône de copie ; elle fonctionne sans réseau et affiche à côté du bouton « Adresse copiée » ou « Copie impossible sur cet appareil » ;
- un **document local** est un bouton sur fond sauge avec une icône de fichier ; il récupère uniquement le PDF rattaché au voyage courant dans IndexedDB ;
- une **réservation** conserve son bloc structuré sur fond soleil clair et ses références propres ;
- un **service externe** ouvre un lien HTTPS dans un nouvel onglet avec `noopener noreferrer` et indique de manière accessible qu'une connexion est requise.

Hors connexion, les liens externes sont désactivés mais le programme, les réservations et les PDF déjà importés restent consultables. Une seconde vérification d'URL à l'affichage neutralise toute valeur non HTTPS, en complément du schéma et de la validation métier. Aucun HTML importé, SVG actif ou document exécutable n'est rendu.

Documents et réservations sont reliés aux journées ou étapes exclusivement par identifiants stables. Le document référence à son tour une ressource PDF déclarée dans le manifest. Aucun nom de fichier, chemin ou libellé ne sert à déduire une association.

Dans le déroulé, les liens explicitement portés par l’étape sont suivis des liens de son lieu résolu par `placeId`, puis dédupliqués de manière stable par URL sans modifier les données. Ils restent des liens textuels souples, soulignés et sans carte ou bouton pleine largeur. Les documents gardent une action locale explicite et les réservations directement associées restent présentées comme des détails repliables. Une information descriptive reste du texte.

La première illustration d’une étape peut porter un lien pratique selon une règle déterministe : l’unique lien HTTPS valide de l’étape est prioritaire ; à défaut, et seulement lorsque l’étape ne déclare aucun lien, l’unique lien HTTPS valide de son lieu peut être utilisé. Dès que plusieurs cibles sont possibles, l’image n’est pas interactive et les liens sont tous présentés sous forme textuelle. Les liens de provenance photographique (`sourceUrl` et `licenseUrl`) ne participent jamais à cette résolution. L’image locale reste visible hors connexion, mais sa cible externe est désactivée et annoncée sobrement.

## Pièces du voyage

L’espace **Pièces** est une vue dérivée, sans seconde source de vérité : il est calculé à chaque rendu depuis `travel.documents`, `travel.reservations` et les pièces ajoutées relues dans IndexedDB, par `src/application/travelPieces.ts`. Il ne stocke rien et ne modifie aucune donnée importée.

Règles de rattachement :

- une pièce est rattachée à une journée ou une étape uniquement lorsque son identifiant figure dans les `documentIds` ou `reservationIds` de celle-ci ;
- un document référencé par une réservation hérite, toujours par identifiant, des rattachements de cette réservation ;
- aucun rattachement n’est déduit d’un libellé, d’un nom de fichier, d’une date de réservation ou d’une position ;
- une pièce rattachée à plusieurs journées ou étapes n’apparaît qu’une fois et liste tous ses rattachements ;
- une pièce ajoutée est rattachée par l’identifiant de journée ou d’étape choisi lors de l’ajout ; si cette cible n’existe pas, elle vise tout le voyage.

L’écran affiche le titre « Pièces du voyage », un compteur, puis un regroupement « Par jour » : « Tout le voyage » pour les pièces sans rattachement, puis une section par journée dans l’ordre du programme. Une pièce rattachée à plusieurs journées figure sous la première ; ses autres rattachements portent leur date. Aucune section vide n’est rendue ; un voyage sans document ni réservation reçoit un état vide explicite.

Chaque ligne présente une icône propre à l’entité (fichier sur fond sauge pour un document, billet sur fond soleil clair pour une réservation, fichier ou image sur fond sable pour une pièce ajoutée), le titre, les rattachements, le format (« PDF », « Image » ou « Réservation ») et l’origine, « Dossier » ou « Ajoutée », distinguée par son texte et pas seulement par sa couleur. Un bouton « Ajouter une pièce » ouvre le formulaire d’ajout. Son nom accessible (« Voir la fiche … ») ponctue ces fragments. Chaque ligne ouvre la fiche de la pièce.

Le badge « Toutes disponibles hors connexion » n’apparaît que si le voyage contient au moins un document ou une pièce ajoutée, et que chaque ressource PDF du dossier est effectivement présente dans `travelResources` pour ce voyage, vérifié par `listResourceIds` sans lire les octets. Une ressource absente est signalée sur sa ligne par « Absent de cet appareil » ; une erreur de lecture du stockage n’affiche ni badge ni avertissement.

Le contrat ne porte aucun type ou catégorie sur les documents et réservations. Le regroupement « Par type » n’est donc pas proposé : il n’est jamais reconstruit à partir des titres.

## Pièces du jour

Sous l’en-tête de la journée, une bande « Pièces du jour · N » présente les pièces rattachées à la journée, directement ou par l’une de ses étapes, sous forme de cartes de 12,25 rem (196 px) défilant horizontalement dans leur propre région : icône, titre, rattachement dans la journée et format. Un bouton « Toutes les pièces » mène à l’espace Pièces. La bande n’existe pas pour une journée sans pièce.

La bande remplace l’ancien bloc « Informations associées à la journée » des compléments, afin que les documents et réservations de la journée ne soient pas présentés deux fois. Chaque carte ouvre la fiche de sa pièce.

Dans la frise, chaque étape garde ses actions au point d’usage : documents en boutons « document local », réservations en détail repliable et liens externes en liens textuels, sans répéter l’adresse ou les liens déjà présentés.

## Espace de l’étape

La vue `step` affiche, sous la barre de titre « Jour N sur M », un bouton « Retour à la journée » (date et titre de la journée), puis l’horaire ou « Sans horaire », le titre, le lieu résolu par `placeId` et la description éventuelle. Chaque réservation de l’étape conserve son bloc structuré sur fond soleil clair ; seuls les champs présents dans les données sont affichés (référence, date, heure, statut). Le contrat ne porte pas de point de rendez-vous : aucun n’est inventé.

La liste « Pièces de cette étape · N » réunit les documents rattachés à l’étape, directement ou par l’une de ses réservations ; ces documents ne sont pas répétés dans le bloc de réservation et chaque ligne ouvre la fiche de la pièce. Les « Liens utiles » regroupent sans doublon les liens de l’étape et de son lieu. Une section sans contenu n’est pas rendue. Une étape inconnue ramène à l’aperçu, comme une journée inconnue.

## Fiche d’une pièce

La vue `piece` est identifiée par la nature de la pièce et son identifiant stable (`document=…` ou `reservation=…` dans l’URL) ; une pièce inconnue ramène à l’aperçu. L’onglet Pièces reste actif et un bouton « Retour aux pièces du voyage » ramène à l’espace Pièces.

La fiche affiche une icône, le titre et les badges de format (« PDF » ou « Réservation ») et d’origine (« Dossier »). Aucun aperçu n’est rendu : l’application n’embarque pas de lecteur PDF et ne présente jamais d’aperçu factice. Pour un document, la description éventuelle précède le bouton « Ouvrir le PDF », sur fond sauge, qui réutilise l’ouverture locale existante : relecture dans IndexedDB avec la clé du voyage courant, puis URL d’objet temporaire révoquée. Pour une réservation, son bloc structuré remplace ce bouton.

Les métadonnées donnent le format, le stockage et l’origine (« Fournie avec le dossier du voyage »). Pour un document, le stockage n’annonce « Sur cet appareil, disponible hors connexion » qu’après vérification de la ressource par `listResourceIds` ; sinon il indique « Absent de cet appareil » ou « Stockage local du voyage, non vérifié ». La liste « Rattachée à » mène à chaque journée et étape rattachée par identifiant, puis à l’espace Pièces ; une pièce sans rattachement porte la mention « Tout le voyage ». La mention « Pièce du dossier : en lecture seule » rappelle qu’aucune action ne modifie le contenu importé.

## Pièces ajoutées

Le formulaire « Ajouter une pièce » propose deux sources : « Choisir un fichier » (PDF, JPEG, PNG ou WebP) et « Prendre une photo » (champ fichier avec `capture="environment"`). Le format est reconnu par la signature binaire, jamais par le nom du fichier ; un format refusé, un fichier vide ou de plus de 10 Mo produit un message explicite. Le titre, le type (Transport, Hébergement, Activité, Assurance, Autre) et le rattachement (tout le voyage, une journée ou une étape) utilisent de vrais `<label>`, `<input>` et `<select>`. Le formulaire rappelle : « Cette pièce reste sur cet appareil, comme vos notes et vos checklists. » Depuis l’espace d’une étape, « Ajouter une pièce à cette étape » présélectionne cette étape ; « Annuler » y ramène. Après l’enregistrement, la fiche de la nouvelle pièce s’ouvre.

La fiche d’une pièce ajoutée affiche son type, sa date d’ajout et l’origine « Ajoutée sur cet appareil ». Un PDF s’ouvre par l’action document local ; une image est affichée en aperçu depuis une URL d’objet révoquée au démontage. Seules les pièces ajoutées proposent « Renommer » et « Supprimer » ; la suppression exige une confirmation explicite qui nomme la pièce et rappelle qu’elle est définitive. Aucune action n’écrit dans les pièces du dossier.

## Mode présentation

Le bouton « Présenter » d’une image ajoutée ouvre une boîte de dialogue modale plein écran sur fond blanc, avec le titre, l’image, le rattachement et un bouton « Fermer » qui reçoit le focus ; Échap ferme aussi la présentation et le focus revient au bouton d’origine. L’application tente de garder l’écran allumé avec l’API Screen Wake Lock (`src/services/screenWakeLock.ts`) : en l’absence de l’API ou en cas de refus, elle se replie silencieusement. La mention « Écran maintenu allumé » n’apparaît que lorsque le verrou est réellement obtenu et disparaît s’il est libéré ; il est redemandé au retour sur la page et libéré à la fermeture.

## Variantes

Les variantes ne remplacent jamais le programme standard. Les adaptations « Économe en marche » et « Pluie » qui ciblent la journée ou l’une de ses étapes sont réunies dans une section « Plans B » des compléments de la journée ; chacune indique si elle vaut pour toute la journée ou quelle étape elle remplace ou complète. Au point d’usage, l’étape ou l’en-tête de journée concerné affiche un rappel « Plan B prévu » sur fond sauge qui amène le focus sur l’alternative correspondante. Ni la section ni les rappels n’apparaissent lorsqu’aucune variante ne concerne la journée affichée.

## Checklists et note locale

Les définitions de checklists proviennent uniquement de `voyage.json` 1.2.0. Une checklist de journée reste disponible dans les compléments de la journée et une checklist d’étape auprès de l’étape ciblée. La section Préparation offre en plus une vue regroupée : checklists du voyage, puis checklists de journées et d’étapes organisées par cible. La vue d’ensemble ne mélange pas ces tâches au résumé du séjour. Aucune section vide n’est rendue.

Le changement de case fournit un retour immédiat, attend la fin de l’écriture locale puis annonce la réussite. En cas d’échec, la valeur persistée précédente est rétablie et une erreur est annoncée. Les voyages 1.0.0 et 1.1.0 n’ont simplement aucune checklist.

La zone « Notes personnelles », placée dans Préparation, expose une seule note générale par voyage. Son `textarea` charge la valeur locale, conserve le texte comme texte brut et déclenche un enregistrement temporisé de la dernière valeur. Une perte de focus force l’écriture en attente. Les états « modification », « enregistrement », « enregistré » et « échec » sont annoncés, et l’interface rappelle que la note reste sur cet appareil. Ni la note ni les cases ne sont stockées dans l’URL ou `localStorage`.

## Illustrations et crédits

`voyage.json` 1.3.0 peut associer une couverture au voyage et des illustrations aux journées ou étapes. L’interface relit toujours les octets validés depuis `travelResources` avec le `travelId` courant ; elle ne charge jamais `sourceUrl` ou `licenseUrl` comme image ou comme action pratique. La couverture est chargée normalement et les images secondaires en différé.

Le rendu utilise `figure`, `img` et `figcaption`, le texte alternatif importé, un ratio visuel 16:9 et `object-fit: cover`. L’absence d’illustration ne crée aucun emplacement. Une ressource exceptionnellement illisible produit un remplacement textuel sans masquer le programme. Les URL d’objet temporaires sont révoquées au démontage ou au changement de ressource.

Les infos pratiques regroupent sans doublon les illustrations effectivement référencées et affichent leur provenance : auteur, source et licence HTTPS, photographie personnelle ou génération par IA. Ces liens sont explicitement externes et désactivés hors connexion ; la ressource locale affichée reste disponible.

## États vides et erreurs

La consultation gère :

- une bibliothèque vide ;
- le chargement de la bibliothèque ou d’un voyage ;
- une erreur IndexedDB ou un voyage introuvable ;
- un voyage sans journée ;
- une journée sans étape ;
- un voyage sans hébergement ;
- l’absence de champs facultatifs ;
- une date actuelle située avant, après ou dans un jour non décrit du séjour.

Un retour vers la bibliothèque reste disponible lorsque le voyage ne peut pas être consulté.

## Accessibilité et adaptation mobile

Les vues utilisent des régions, titres, listes ordonnées, articles, éléments `time`, `address` et navigations nommées. Les contrôles sont des boutons natifs utilisables au clavier avec un focus visible et une hauteur tactile minimale. La vue et la journée actives sont annoncées par du texte et `aria-current`, jamais uniquement par une couleur.

Le sélecteur de journées présente des pastilles compactes (jour de la semaine et numéro) qui peuvent défiler horizontalement dans leur propre région sur petit écran ; le nom accessible de chaque pastille donne la date complète et le titre de la journée. La journée du jour porte un point et la mention accessible « aujourd’hui ». Les flèches gauche et droite changent de journée depuis le sélecteur, tandis que des boutons précédent et suivant restent disponibles en fin de journée. La barre de titre indique « Jour N sur M ». La journée active combine pastille inversée, texte et `aria-current`. Les cartes et la chronologie conservent un ordre HTML logique, restent lisibles sans animation et n’imposent aucun défilement horizontal au contenu essentiel.

## Tests

Les règles pures de date et d’hébergement, les vues React et l’orchestration avec le dépôt sont testées avec :

```bash
npm run test
```

La suite couvre les cinq sections, le calcul et le regroupement des pièces, la chronologie, les étapes sans heure, le sélecteur de journées, les états vides, la centralisation des hébergements, les fuseaux horaires, le rechargement par identifiant, l’isolation entre voyages, les erreurs de lecture, les portées de checklist, l’enregistrement des cases et de la note, les illustrations et crédits, la règle des images cliquables, la déduplication des liens d’étape et de lieu, leur comportement hors connexion, la révocation des URL d’objet, le rendu à petite largeur ainsi que l’absence de surface d’exécution du HTML importé.

## Limites actuelles

Restent hors périmètre :

- la validation de l’installation depuis une adresse HTTPS réelle et la recette sur iPhone de l’étape 9 ;
- toute galerie, édition ou téléchargement distant d’image ; seul le mode présentation d’une image ajoutée occupe le plein écran ;
- les notes multiples, riches, partagées ou avec pièces jointes ;
- toute carte, navigation GPS, modification de réservation ou lecteur PDF intégré ;
- une taxonomie métier dédiée aux transports : les lieux non liés à un hébergement sont regroupés sous « Lieux et transports utiles » sans déduction sémantique ;
- un statut de réservation structuré : les éléments « à confirmer » reposent actuellement sur le texte facultatif de statut déjà présent dans le contrat.
