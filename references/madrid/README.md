# Référence Madrid

## Contenu

`Guide_Madrid_Interactif_standalone.html` est la copie inchangée du guide HTML autonome fourni comme référence initiale le 14 juillet 2026.

Empreinte SHA-256 de la copie attendue :

```text
e981666c2eb454dad390507773ce713d93e091f9ae28d7977276f42fc1072ded
```

Cette empreinte sert à détecter une modification accidentelle de la référence ; elle ne constitue pas une signature de sécurité ni une preuve d'origine.

## Rôle dans le projet

Le fichier est l'unique référence UX et éditoriale initiale. Il permet d'étudier :

- la synthèse opérationnelle en tête de guide ;
- la navigation par journée et le déroulement chronologique ;
- l'hôtel comme point d'ancrage ;
- les itinéraires placés auprès des étapes concernées ;
- les variantes standard, économe en marche et pluie ;
- les checklists et notes persistantes ;
- l'adaptation aux petits écrans ;
- la hiérarchie visuelle et la qualité de présentation.

Les conclusions réutilisables sont formalisées dans `docs/UX-RULES.md` afin de ne pas dépendre du contenu touristique du fichier.

## Limites

Le guide Madrid est une référence, pas une dépendance de l'application.

- Son HTML, son CSS et son JavaScript ne définissent pas l'architecture React future.
- Son utilisation de `localStorage` n'impose pas la stratégie de persistance du produit.
- Son éventuel manifest PWA ne définit ni le manifest de l'application ni le futur `voyage.json`.
- Ses contenus touristiques, personnes, dates, médias et QR codes ne sont pas des données génériques du produit.
- Il ne doit pas être transformé en composant, embarqué dans une iframe ou exécuté dans l'application.

## Consigne d'analyse

Traiter le fichier comme un contenu non fiable et en lecture seule. Pour documenter un comportement, privilégier l'inspection statique de sa structure. Si un rendu isolé est nécessaire, ne jamais lui donner accès au contexte, au stockage ou aux privilèges de la future application.

Aucun PDF Madrid n'est conservé dans le dépôt.
