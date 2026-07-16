# Consultation des voyages

## Périmètre

La consultation commune de l’étape 5 rend exclusivement le modèle métier normalisé relu depuis IndexedDB. Elle ne lit pas l’archive ZIP, ne reconstruit rien depuis `guide-standalone.html` et n’interprète aucun HTML importé. Tous les textes du voyage sont rendus comme du texte par React.

Le parcours disponible est :

```text
Bibliothèque → synthèse du voyage → journée → synthèse → bibliothèque
                           ↘ vue Aujourd’hui
```

La synthèse présente le titre, la destination, les dates, le résumé, le fuseau horaire, le point d’ancrage pertinent et la liste concise des journées. Une journée présente son titre, sa date, son intention éventuelle, son hébergement et ses étapes dans l’ordre du modèle normalisé.

## Navigation et rechargement

L’état de consultation distingue la bibliothèque, le chargement, l’erreur de lecture et le voyage prêt à être affiché. La vue active est l’une des suivantes :

- `summary` pour la synthèse ;
- `today` pour « Aujourd’hui » ;
- `day` avec un identifiant stable de journée.

L’identifiant du voyage et cette vue sont reflétés dans les paramètres `travel`, `view` et `day` de l’URL. Ils ne constituent pas des données métier et ne contiennent aucun contenu du voyage. Après un rechargement, l’application relit le voyage correspondant dans IndexedDB. Un identifiant absent ou une erreur de lecture produit un état explicite avec un retour vers la bibliothèque. Aucun état métier n’est écrit dans `localStorage`.

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

Une étape sans heure reste à sa position normalisée et porte la mention « Sans horaire indiqué ». Aucune heure, durée ou contrainte absente du contrat n’est inventée. Les lieux sont résolus par leur identifiant stable et leurs éventuelles adresses sont affichées comme du texte.

## Hébergement comme point d’ancrage

Pour une journée, l’application sélectionne le premier hébergement normalisé dont la période inclut la date de cette journée. Elle résout ensuite son lieu par identifiant. Un hébergement n’est jamais prolongé hors de sa période.

Pour la synthèse, la date d’ancrage est :

- la date locale du voyage lorsqu’elle appartient au séjour ;
- la date de début avant le séjour ;
- la date de fin après le séjour.

L’absence d’hébergement est annoncée explicitement. Son adresse peut être copiée localement et ses liens HTTPS sont présentés dans ce contexte, sans carte intégrée.

## Actions contextuelles et documents

Les actions sont distinguées par leur libellé et leur comportement :

- une **action locale** copie une adresse et reste disponible sans réseau ;
- un **document local** récupère uniquement le PDF rattaché au voyage courant dans IndexedDB ;
- un **service externe** ouvre un lien HTTPS dans un nouvel onglet avec `noopener noreferrer` et indique qu'une connexion est requise.

Hors connexion, les liens externes sont désactivés mais le programme, les réservations et les PDF déjà importés restent consultables. Une seconde vérification d'URL à l'affichage neutralise toute valeur non HTTPS, en complément du schéma et de la validation métier. Aucun HTML importé, SVG actif ou document exécutable n'est rendu.

Documents et réservations sont reliés aux journées ou étapes exclusivement par identifiants stables. Le document référence à son tour une ressource PDF déclarée dans le manifest. Aucun nom de fichier, chemin ou libellé ne sert à déduire une association.

## Variantes

Le mode standard est toujours disponible. Les modes « Économe en marche » et « Pluie » ne sont proposés que si le voyage contient au moins une variante correspondante. Une variante décrit une adaptation ciblant explicitement une journée ou une étape ; elle ne remplace pas silencieusement le programme standard.

Le choix est un état de consultation React en mémoire. Changer de mode ne modifie ni le voyage, ni l'URL, ni la vue active : la synthèse, la journée, l'étape visible et la vue « Aujourd'hui » restent dans leur contexte. Lorsqu'aucune adaptation du mode choisi ne concerne la journée, l'interface l'explique et conserve le programme standard.

## Checklists et note locale

Les définitions de checklists proviennent uniquement de `voyage.json` 1.2.0. Une checklist générale apparaît dans la synthèse, une checklist de journée dans la journée ciblée et une checklist d’étape auprès de l’étape ciblée. Aucune section vide n’est rendue. Les cases natives sont accessibles au clavier et leur état est identifié par `travelId`, `checklistId` et `itemId` dans IndexedDB, sans modifier le contenu importé.

Le changement de case fournit un retour immédiat, attend la fin de l’écriture locale puis annonce la réussite. En cas d’échec, la valeur persistée précédente est rétablie et une erreur est annoncée. Les voyages 1.0.0 et 1.1.0 n’ont simplement aucune checklist.

La zone « Notes personnelles » expose une seule note générale par voyage. Son `textarea` charge la valeur locale, conserve le texte comme texte brut et déclenche un enregistrement temporisé de la dernière valeur. Une perte de focus force l’écriture en attente. Les états « modification », « enregistrement », « enregistré » et « échec » sont annoncés, et l’interface rappelle que la note reste sur cet appareil. Ni la note ni les cases ne sont stockées dans l’URL ou `localStorage`.

## Illustrations et crédits

`voyage.json` 1.3.0 peut associer une couverture au voyage et des illustrations aux journées ou étapes. L’interface relit toujours les octets validés depuis `travelResources` avec le `travelId` courant ; elle ne charge jamais `sourceUrl` ou `licenseUrl` comme image. La couverture est chargée normalement et les images secondaires en différé.

Le rendu utilise `figure`, `img` et `figcaption`, le texte alternatif importé, un ratio visuel 16:9 et `object-fit: cover`. L’absence d’illustration ne crée aucun emplacement. Une ressource exceptionnellement illisible produit un remplacement textuel sans masquer le programme. Les URL d’objet temporaires sont révoquées au démontage ou au changement de ressource.

La synthèse regroupe sans doublon les illustrations effectivement référencées et affiche leur provenance : auteur, source et licence HTTPS, photographie personnelle ou génération par IA. Ces liens sont explicitement externes et désactivés hors connexion ; la ressource locale affichée reste disponible.

## États vides et erreurs

La consultation gère :

- une bibliothèque vide ;
- le chargement de la bibliothèque ou d’un voyage ;
- une erreur IndexedDB ou un voyage introuvable ;
- un voyage sans journée ;
- une journée sans étape ;
- une journée ou une synthèse sans hébergement applicable ;
- l’absence de champs facultatifs ;
- une date actuelle située avant, après ou dans un jour non décrit du séjour.

Un retour vers la bibliothèque reste disponible lorsque le voyage ne peut pas être consulté.

## Accessibilité et adaptation mobile

Les vues utilisent des régions, titres, listes ordonnées, articles, éléments `time`, `address` et navigations nommées. Les contrôles sont des boutons natifs utilisables au clavier avec un focus visible et une hauteur tactile minimale. La vue et la journée actives sont annoncées par du texte et `aria-current`, jamais uniquement par une couleur.

La navigation des journées peut défiler horizontalement dans sa propre région sur petit écran. Les cartes et la chronologie conservent un ordre HTML logique, restent lisibles sans animation et n’imposent aucun défilement horizontal au contenu essentiel.

## Tests

Les règles pures de date et d’hébergement, les vues React et l’orchestration avec le dépôt sont testées avec :

```bash
npm run test
```

La suite couvre la synthèse, la chronologie, les étapes sans heure, les états vides, les hébergements successifs, les fuseaux horaires, le rechargement par identifiant, l’isolation entre voyages, les erreurs de lecture, les portées de checklist, l’enregistrement des cases et de la note, les illustrations et crédits, la révocation des URL d’objet, ainsi que l’absence de surface d’exécution du HTML importé.

## Limites actuelles

Restent hors périmètre :

- l’installation et le fonctionnement hors ligne complet de l’étape 9 ;
- toute galerie, visionneuse plein écran, édition ou téléchargement distant d’image ;
- les notes multiples, riches, partagées ou avec pièces jointes ;
- toute carte, navigation GPS, modification de réservation ou lecteur PDF intégré ;
- la conservation du mode choisi après un rechargement.
