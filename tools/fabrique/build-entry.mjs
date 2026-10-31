// Point d'entrée du validateur de la Fabrique de carnets de voyage.
//
// Ce fichier n'est pas exécuté directement : il est compilé avec esbuild en
// `validate-package.mjs`, qui embarque le code d'import réel de l'application
// (src/import et src/application). La Fabrique obtient ainsi exactement le
// même verdict que l'application au moment de l'import.
//
// Régénération (depuis la racine du dépôt, après `npm ci`) :
//   npx esbuild tools/fabrique/build-entry.mjs --bundle --platform=node \
//     --format=esm --target=node20 --legal-comments=none --minify-whitespace \
//     --define:__SOURCE_COMMIT__="\"$(git rev-parse --short HEAD)\"" \
//     --outfile=tools/fabrique/validate-package.mjs
//
// Usage du fichier compilé :
//   node validate-package.mjs package <paquet.zip>
//   node validate-package.mjs travel <voyage.json>
//   node validate-package.mjs version

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { importTravelPackage } from '../../src/import/importTravelPackage.ts'
import { validateTravelDocument } from '../../src/application/validateTravelDocument.ts'
import { PACKAGE_FORMAT_VERSION } from '../../src/import/packageManifest.ts'
import { SUPPORTED_TRAVEL_CONTENT_VERSIONS } from '../../src/contracts/voyage/registry.ts'

/* global __SOURCE_COMMIT__ */
const SOURCE_COMMIT =
  typeof __SOURCE_COMMIT__ === 'string' ? __SOURCE_COMMIT__ : 'inconnu'

function print(result) {
  console.log(JSON.stringify(result, null, 2))
}

async function validatePackage(path) {
  const bytes = await readFile(path)
  const result = await importTravelPackage({
    name: basename(path),
    type: 'application/zip',
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  })

  if (!result.ok) {
    return { ok: false, kind: result.kind, errors: result.errors }
  }

  const { manifest, travel, resources, guideStandalonePresent } = result.package
  return {
    ok: true,
    id: manifest.id,
    packageFormatVersion: manifest.packageFormatVersion,
    travelModelVersion: manifest.travelModelVersion,
    title: travel.title,
    days: travel.days.length,
    resources: resources.length,
    guideStandalonePresent,
  }
}

async function validateTravel(path) {
  let input
  try {
    input = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: 'JSON_INVALID', message: String(error?.message ?? error) }],
    }
  }

  const result = validateTravelDocument(input)
  return result.valid
    ? { ok: true, id: result.travel.id, days: result.travel.days.length }
    : { ok: false, errors: result.issues }
}

async function main() {
  const [command, path] = process.argv.slice(2)

  if (command === 'version') {
    print({
      sourceCommit: SOURCE_COMMIT,
      packageFormatVersion: PACKAGE_FORMAT_VERSION,
      travelModelVersions: SUPPORTED_TRAVEL_CONTENT_VERSIONS,
    })
    return
  }

  if ((command !== 'package' && command !== 'travel') || !path) {
    console.error(
      'Usage : node validate-package.mjs package <paquet.zip> | travel <voyage.json> | version',
    )
    process.exitCode = 2
    return
  }

  const result =
    command === 'package' ? await validatePackage(path) : await validateTravel(path)
  print(result)
  if (!result.ok) {
    process.exitCode = 1
  }
}

await main()
