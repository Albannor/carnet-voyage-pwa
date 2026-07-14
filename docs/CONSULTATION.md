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

Une étape sans heure reste à sa position normalisée et porte la mention « Sans horaire indiqué ». Aucune heure, durée ou contrainte absente du contrat n’est inventée. Les lieux sont résolus par leur identifiant stable et leurs éventuelles adresses sont affichées comme du texte. Les liens ne sont pas encore exposés : ils appartiennent à l’étape 6.

## Hébergement comme point d’ancrage

Pour une journée, l’application sélectionne le premier hébergement normalisé dont la période inclut la date de cette journée. Elle résout ensuite son lieu par identifiant. Un hébergement n’est jamais prolongé hors de sa période.

Pour la synthèse, la date d’ancrage est :

- la date locale du voyage lorsqu’elle appartient au séjour ;
- la date de début avant le séjour ;
- la date de fin après le séjour.

L’absence d’hébergement est annoncée explicitement. Aucune action de copie, d’itinéraire ou de carte n’est fournie à cette étape.

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

La suite couvre la synthèse, la chronologie, les étapes sans heure, les états vides, les hébergements successifs, les fuseaux horaires, le rechargement par identifiant, l’isolation entre voyages, les erreurs de lecture et l’absence de surface d’exécution du HTML importé.

## Limites actuelles

Restent hors périmètre :

- les liens, itinéraires, ressources et variantes contextuelles de l’étape 6 ;
- les checklists et notes personnelles de l’étape 7 ;
- l’installation et le fonctionnement hors ligne complet de l’étape 8 ;
- toute carte, navigation GPS, réservation ou action sur une adresse.
