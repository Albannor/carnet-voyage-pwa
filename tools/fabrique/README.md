# Outils de la Fabrique de carnets de voyage

Ces outils servent à produire, hors de l'application, des paquets ZIP importables dans Carnet de voyage PWA. Ils sont utilisés par la skill Claude « fabrique-carnet-voyage », qui les récupère depuis l'étiquette `fabrique-v1` de ce dépôt.

Ils ne font pas partie de l'application : ils ne sont ni compilés, ni testés, ni déployés avec elle, et ne modifient aucun contrat. Le format des paquets reste défini par [`docs/IMPORT.md`](../../docs/IMPORT.md), [`docs/GUIDE-FORMAT.md`](../../docs/GUIDE-FORMAT.md) et les schémas de `contracts/`.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `validate-package.mjs` | Code d'import réel de l'application (`src/import`, `src/application`) compilé en un seul fichier Node.js. Donne le même verdict que l'application. |
| `build-entry.mjs` | Source du validateur compilé. |
| `package.py` | Inventaire des ressources, construction de `manifest.json` (tailles, SHA-256), production du ZIP, réouverture et validation finale. |
| `commons.py` | Recherche de photographies Wikimedia Commons sous licence acceptée par le contrat 1.3.0, conversion en WebP et provenance `licensed`. |

## Prérequis

- Node.js 20 ou plus récent ;
- Python 3.10 ou plus récent ;
- Pillow pour `commons.py` (`pip install pillow`) ;
- accès réseau à `commons.wikimedia.org` et `upload.wikimedia.org` pour `commons.py`.

## Utilisation

Dossier de travail attendu :

```text
travail/
├── voyage.json
├── assets/                    # PNG, JPEG ou WebP
├── documents/                 # PDF
└── guide-standalone.html      # facultatif
```

```bash
# Images
python3 tools/fabrique/commons.py search "Palacio Real Madrid" --limit 6
python3 tools/fabrique/commons.py preview travail "File:Titre 1.jpg" "File:Titre 2.jpg"
python3 tools/fabrique/commons.py fetch travail "File:Titre 1.jpg" palais-royal

# Identifiants des ressources à reporter dans voyage.json
python3 tools/fabrique/package.py inventory travail

# Contrôle rapide de voyage.json seul
node tools/fabrique/validate-package.mjs travel travail/voyage.json

# Paquet final : construit, rouvert et validé ; conservé seulement s'il est valide
python3 tools/fabrique/package.py build travail sortie/voyage.zip
```

Les identifiants de ressources sont dérivés des noms de fichiers : `assets/palais-royal.webp` devient `image-palais-royal`, `documents/billet-train.pdf` devient `document-billet-train`.

## Licences retenues par `commons.py`

Domaine public avec URL de licence publiée, CC0 1.0, CC BY et CC BY-SA 2.0, 2.5, 3.0 et 4.0 en version internationale. Sont écartés : auteur non renseigné, licences NC ou ND, versions transposées (par exemple CC BY-SA 3.0 DE), GFDL seule, restrictions déclarées (droit à l'image, marque) et images de moins de 1 000 px. Les images étant redimensionnées et converties, la provenance indique toujours `modified: true`.

## Régénérer le validateur

À faire après toute modification de `src/import`, `src/contracts` ou `src/domain`, notamment lors d'une nouvelle version du contrat :

```bash
npm ci
npx esbuild tools/fabrique/build-entry.mjs --bundle --platform=node \
  --format=esm --target=node20 --legal-comments=none --minify-whitespace \
  --define:__SOURCE_COMMIT__="\"$(git rev-parse --short HEAD)\"" \
  --outfile=tools/fabrique/validate-package.mjs
node tools/fabrique/validate-package.mjs version
```

Puis déplacer l'étiquette utilisée par la skill, ou en créer une nouvelle et mettre la skill à jour.
