import { readFile, readdir } from 'node:fs/promises'
import { extname } from 'node:path'

const DIST_DIRECTORY = new URL('../dist/', import.meta.url)
const REQUIRED_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'favicon.png',
  'icons/carnet.svg',
  'icons/carnet-192.png',
  'icons/carnet-512.png',
  'icons/carnet-maskable-512.png',
  'icons/apple-touch-icon-180.png',
]
const EXPECTED_PNG_DIMENSIONS = new Map([
  ['favicon.png', [32, 32]],
  ['icons/carnet-192.png', [192, 192]],
  ['icons/carnet-512.png', [512, 512]],
  ['icons/carnet-maskable-512.png', [512, 512]],
  ['icons/apple-touch-icon-180.png', [180, 180]],
])

function fail(message) {
  throw new Error(`Build PWA invalide : ${message}`)
}

async function readDistFile(path) {
  try {
    return await readFile(new URL(path, DIST_DIRECTORY))
  } catch {
    fail(`fichier absent : dist/${path}`)
  }
}

function assertPng(buffer, path, expectedDimensions) {
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    fail(`dist/${path} n’est pas un PNG`)
  }

  const dimensions = [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
  if (dimensions.some((value, index) => value !== expectedDimensions[index])) {
    fail(
      `dist/${path} mesure ${dimensions.join('x')} au lieu de ${expectedDimensions.join('x')}`,
    )
  }
}

await Promise.all(REQUIRED_FILES.map((path) => readDistFile(path)))

for (const [path, dimensions] of EXPECTED_PNG_DIMENSIONS) {
  assertPng(await readDistFile(path), path, dimensions)
}

const manifest = JSON.parse(
  (await readDistFile('manifest.webmanifest')).toString('utf8'),
)

for (const field of [
  'id',
  'name',
  'short_name',
  'description',
  'lang',
  'start_url',
  'scope',
  'display',
  'theme_color',
  'background_color',
]) {
  if (!manifest[field]) fail(`champ de manifeste absent : ${field}`)
}

if (
  manifest.lang !== 'fr' ||
  manifest.display !== 'standalone' ||
  manifest.id !== './' ||
  manifest.start_url !== './' ||
  manifest.scope !== './'
) {
  fail('champs essentiels du manifeste incohérents')
}

const iconPurposes = new Map(
  manifest.icons.map((icon) => [`${icon.src}:${icon.sizes}`, icon.purpose]),
)
if (
  iconPurposes.get('icons/carnet-192.png:192x192') !== 'any' ||
  iconPurposes.get('icons/carnet-512.png:512x512') !== 'any' ||
  iconPurposes.get('icons/carnet-maskable-512.png:512x512') !== 'maskable'
) {
  fail('inventaire des icônes du manifeste incohérent')
}

const indexHtml = (await readDistFile('index.html')).toString('utf8')
if (/\b(?:href|src)="\//.test(indexHtml)) {
  fail('index.html contient un chemin de ressource dépendant de la racine')
}
if (
  !indexHtml.includes('rel="manifest"') ||
  !indexHtml.includes('rel="apple-touch-icon"') ||
  !indexHtml.includes('name="theme-color"')
) {
  fail('métadonnées PWA ou iOS absentes de index.html')
}

const serviceWorker = (await readDistFile('sw.js')).toString('utf8')
for (const path of [
  'index.html',
  'manifest.webmanifest',
  'favicon.png',
  'icons/carnet-192.png',
  'icons/carnet-512.png',
  'icons/carnet-maskable-512.png',
  'icons/apple-touch-icon-180.png',
]) {
  const matches = serviceWorker.match(new RegExp(`url:"${path.replaceAll('.', '\\.')}`, 'g'))
  if (matches?.length !== 1) {
    fail(`dist/${path} doit apparaître une seule fois dans le précache`)
  }
}
for (const font of [
  'fraunces-latin-opsz-normal',
  'fraunces-latin-ext-opsz-normal',
  'inter-latin-wght-normal',
  'inter-latin-ext-wght-normal',
]) {
  if (!new RegExp(`url:"assets/${font}-[^"]+\\.woff2"`).test(serviceWorker)) {
    fail(`la police embarquée ${font} doit appartenir au précache`)
  }
}
if (serviceWorker.includes('url:"guide-standalone.html"')) {
  fail('guide-standalone.html ne doit pas appartenir au précache')
}
if (/indexedDB|travelResources|personalStates|userPieces|userPieceFiles/.test(serviceWorker)) {
  fail('le service worker ne doit pas manipuler les données IndexedDB')
}

const distEntries = await readdir(DIST_DIRECTORY, { recursive: true })
const workboxFiles = distEntries.filter(
  (entry) => extname(entry) === '.js' && entry.startsWith('workbox-'),
)
if (workboxFiles.length !== 1) {
  fail('le runtime Workbox attendu est absent ou dupliqué')
}
if (distEntries.some((entry) => entry === '.DS_Store' || entry.endsWith('/.DS_Store'))) {
  fail('un fichier temporaire .DS_Store a été copié dans dist/')
}

console.log(
  `Build PWA vérifié : manifeste, shell, ${EXPECTED_PNG_DIMENSIONS.size} icônes PNG, service worker et runtime Workbox.`,
)
