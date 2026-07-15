import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import dangerousUrl from '../../examples/voyage/1.0.0/invalid/dangerous-url.json'
import duplicateId from '../../examples/voyage/1.0.0/invalid/duplicate-id.json'
import missingReferences from '../../examples/voyage/1.0.0/invalid/missing-references.json'
import missingTitle from '../../examples/voyage/1.0.0/invalid/missing-required-title.json'
import validTravel from '../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import validTravelV1_1 from '../../examples/voyage/1.1.0/valid/coastal-trip.json'
import type { TravelDocumentV1 } from '../contracts/voyage/v1/document'
import type { TravelDocumentV1_1 } from '../contracts/voyage/v1_1/document'
import { IMPORT_LIMITS } from './limits'
import { importTravelPackage } from './importTravelPackage'
import { normalizeTravelDocument } from './migrations/registry'
import { sha256Hex } from './sha256'
import {
  createPackageArchive,
  selectedPackageFile,
  TEST_PDF_BYTES,
  TEST_PNG_BYTES,
} from './test/packageFixtures'
import { readZipArchive } from './zipArchive'

const validTravelDocument = validTravel as TravelDocumentV1

async function expectImportIssue(
  archive: Uint8Array,
  expected: { code: string; file?: string; field?: string },
) {
  const result = await importTravelPackage(selectedPackageFile(archive))

  expect(result.ok).toBe(false)
  expect(result).not.toHaveProperty('package')
  if (result.ok) {
    throw new Error('Le paquet aurait dû être refusé.')
  }
  expect(result.errors).toContainEqual(expect.objectContaining(expected))
  expect(result.errors[0]?.message).toBeTruthy()
  expect(result.errors[0]?.hint).toBeTruthy()
  return result
}

function duplicateFirstCentralPath(bytes: Uint8Array) {
  const patched = Uint8Array.from(bytes)
  const view = new DataView(patched.buffer)
  const endOffset = patched.length - 22
  const centralOffset = view.getUint32(endOffset + 16, true)
  const firstNameLength = view.getUint16(centralOffset + 28, true)
  const firstExtraLength = view.getUint16(centralOffset + 30, true)
  const firstCommentLength = view.getUint16(centralOffset + 32, true)
  const secondOffset =
    centralOffset + 46 + firstNameLength + firstExtraLength + firstCommentLength
  const secondNameLength = view.getUint16(secondOffset + 28, true)

  expect(secondNameLength).toBe(firstNameLength)
  patched.set(
    patched.slice(centralOffset + 46, centralOffset + 46 + firstNameLength),
    secondOffset + 46,
  )
  return patched
}

describe('import sécurisé d’un paquet ZIP', () => {
  it('importe entièrement un paquet valide et normalisé', async () => {
    const result = await importTravelPackage(
      selectedPackageFile(await createPackageArchive()),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors))
    }
    expect(result.package.manifest.packageFormatVersion).toBe('1.0.0')
    expect(result.package.travel).toMatchObject({
      id: 'madrid-weekend-2026',
      contentVersion: '1.0.0',
    })
    expect(result.package.resources).toHaveLength(1)
    expect(result.package.travel.documents).toEqual([])
    expect(result.package.travel.reservations).toEqual([])
  })

  it('importe et normalise un voyage 1.1.0 avec son document PDF', async () => {
    const pdfHash = await sha256Hex(TEST_PDF_BYTES)
    const result = await importTravelPackage(selectedPackageFile(
      await createPackageArchive({
        travel: validTravelV1_1,
        includeDefaultResource: false,
        manifest: {
          id: validTravelV1_1.id,
          travelModelVersion: '1.1.0',
          resources: [{
            id: 'pdf-ferry-ticket',
            path: 'documents/booking.pdf',
            mediaType: 'application/pdf',
            size: TEST_PDF_BYTES.length,
            sha256: pdfHash,
          }],
        },
        extraFiles: { 'documents/booking.pdf': TEST_PDF_BYTES },
      }),
    ))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(JSON.stringify(result.errors))
    expect(result.package.travel).toMatchObject({
      contentVersion: '1.1.0',
      documents: [{ id: 'document-ticket', resourceId: 'pdf-ferry-ticket' }],
      reservations: [{ id: 'reservation-ferry' }],
    })
    expect(result.package.resources[0]?.mediaType).toBe('application/pdf')
  })

  it('refuse une archive corrompue', async () => {
    await expectImportIssue(new Uint8Array([1, 2, 3]), {
      code: 'ARCHIVE_CORRUPTED',
    })
  })

  it('refuse une archive vide', async () => {
    await expectImportIssue(zipSync({}), { code: 'ARCHIVE_EMPTY' })
  })

  it('refuse un manifest absent', async () => {
    await expectImportIssue(
      await createPackageArchive({ omit: ['manifest.json'] }),
      { code: 'REQUIRED_FILE_MISSING', file: 'manifest.json' },
    )
  })

  it('refuse un voyage.json absent', async () => {
    await expectImportIssue(
      await createPackageArchive({ omit: ['voyage.json'] }),
      { code: 'REQUIRED_FILE_MISSING', file: 'voyage.json' },
    )
  })

  it('refuse un manifest invalide avec le champ concerné', async () => {
    await expectImportIssue(
      await createPackageArchive({ manifest: { id: undefined } }),
      { code: 'MANIFEST_SCHEMA_INVALID', file: 'manifest.json', field: '/id' },
    )
  })

  it('réutilise le schéma voyage pour un voyage.json invalide', async () => {
    await expectImportIssue(await createPackageArchive({ travel: missingTitle }), {
      code: 'SCHEMA_REQUIRED',
      file: 'voyage.json',
      field: '/title',
    })
  })

  it('refuse une version future du paquet', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: { packageFormatVersion: '2.0.0' },
      }),
      {
        code: 'PACKAGE_VERSION_UNSUPPORTED',
        file: 'manifest.json',
        field: '/packageFormatVersion',
      },
    )
  })

  it('refuse une version future du voyage', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: { travelModelVersion: '2.0.0' },
      }),
      {
        code: 'TRAVEL_VERSION_UNSUPPORTED',
        file: 'manifest.json',
        field: '/travelModelVersion',
      },
    )
  })

  it('refuse des versions de voyage contradictoires', async () => {
    await expectImportIssue(
      await createPackageArchive({
        travel: { ...validTravel, contentModelVersion: '2.0.0' },
      }),
      {
        code: 'TRAVEL_VERSION_MISMATCH',
        file: 'voyage.json',
        field: '/contentModelVersion',
      },
    )
  })

  it('refuse un document qui référence une ressource inconnue du manifest', async () => {
    await expectImportIssue(
      await createPackageArchive({
        travel: validTravelV1_1,
        includeDefaultResource: false,
        manifest: {
          id: validTravelV1_1.id,
          travelModelVersion: '1.1.0',
          resources: [],
        },
      }),
      {
        code: 'DOCUMENT_RESOURCE_UNKNOWN',
        file: 'voyage.json',
        field: '/documents/0/resourceId',
      },
    )
  })

  it('refuse un document qui référence une ressource non PDF', async () => {
    const pngHash = await sha256Hex(TEST_PNG_BYTES)
    await expectImportIssue(
      await createPackageArchive({
        travel: validTravelV1_1,
        manifest: {
          id: validTravelV1_1.id,
          travelModelVersion: '1.1.0',
          resources: [{
            id: 'pdf-ferry-ticket',
            path: 'assets/cover.png',
            mediaType: 'image/png',
            size: TEST_PNG_BYTES.length,
            sha256: pngHash,
          }],
        },
      }),
      {
        code: 'DOCUMENT_RESOURCE_NOT_PDF',
        file: 'voyage.json',
        field: '/documents/0/resourceId',
      },
    )
  })

  it('détecte un identifiant métier dupliqué', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: { id: duplicateId.id },
        travel: duplicateId,
      }),
      { code: 'DUPLICATE_ID', file: 'voyage.json', field: '/places/1/id' },
    )
  })

  it('détecte une référence métier inexistante', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: { id: missingReferences.id },
        travel: missingReferences,
      }),
      {
        code: 'UNKNOWN_PLACE_REFERENCE',
        file: 'voyage.json',
        field: '/accommodations/0/placeId',
      },
    )
  })

  it('refuse une ressource déclarée mais absente', async () => {
    await expectImportIssue(
      await createPackageArchive({ omit: ['assets/cover.png'] }),
      { code: 'RESOURCE_MISSING', file: 'assets/cover.png' },
    )
  })

  it('refuse une ressource présente mais non déclarée', async () => {
    await expectImportIssue(
      await createPackageArchive({ includeDefaultResource: false, extraFiles: {
        'assets/unlisted.png': TEST_PNG_BYTES,
      } }),
      { code: 'RESOURCE_UNDECLARED', file: 'assets/unlisted.png' },
    )
  })

  it('refuse une taille de ressource incohérente', async () => {
    const hash = await sha256Hex(TEST_PNG_BYTES)
    await expectImportIssue(
      await createPackageArchive({
        manifest: {
          resources: [{
            id: 'cover-image',
            path: 'assets/cover.png',
            mediaType: 'image/png',
            size: TEST_PNG_BYTES.length + 1,
            sha256: hash,
          }],
        },
      }),
      { code: 'RESOURCE_SIZE_MISMATCH', file: 'assets/cover.png' },
    )
  })

  it('refuse une empreinte SHA-256 incorrecte', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: {
          resources: [{
            id: 'cover-image',
            path: 'assets/cover.png',
            mediaType: 'image/png',
            size: TEST_PNG_BYTES.length,
            sha256: '0'.repeat(64),
          }],
        },
      }),
      { code: 'RESOURCE_HASH_MISMATCH', file: 'assets/cover.png' },
    )
  })

  it('refuse une traversée de répertoire', async () => {
    await expectImportIssue(
      zipSync({ '../evil.txt': strToU8('x') }),
      { code: 'PATH_TRAVERSAL', file: '../evil.txt' },
    )
  })

  it('refuse un chemin absolu', async () => {
    await expectImportIssue(
      zipSync({ '/evil.txt': strToU8('x') }),
      { code: 'PATH_ABSOLUTE', file: '/evil.txt' },
    )
  })

  it('refuse les séparateurs de chemin inattendus', async () => {
    await expectImportIssue(
      zipSync({ 'assets\\evil.png': TEST_PNG_BYTES }),
      { code: 'PATH_INVALID_SEPARATOR', file: 'assets\\evil.png' },
    )
  })

  it('refuse deux chemins en collision de casse', async () => {
    await expectImportIssue(
      zipSync({
        'assets/photo.png': TEST_PNG_BYTES,
        'assets/PHOTO.png': TEST_PNG_BYTES,
      }),
      { code: 'PATH_CASE_COLLISION', file: 'assets/PHOTO.png' },
    )
  })

  it('refuse deux entrées ayant exactement le même chemin', async () => {
    const archive = zipSync({
      'assets/a.png': TEST_PNG_BYTES,
      'assets/b.png': TEST_PNG_BYTES,
    })
    await expectImportIssue(duplicateFirstCentralPath(archive), {
      code: 'PATH_DUPLICATE',
      file: 'assets/a.png',
    })
  })

  it('limite le nombre d’entrées avant décompression', () => {
    const archive = zipSync({
      'manifest.json': strToU8('{}'),
      'voyage.json': strToU8('{}'),
      'assets/extra.png': TEST_PNG_BYTES,
    })
    const result = readZipArchive(archive, {
      ...IMPORT_LIMITS,
      maxFileCount: 2,
    })

    expect(result).toMatchObject({
      ok: false,
      issue: { code: 'FILE_COUNT_EXCEEDED' },
    })
  })

  it('limite la taille totale décompressée avant extraction', () => {
    const archive = zipSync({ 'assets/blob.bin': new Uint8Array(64) }, { level: 0 })
    const result = readZipArchive(archive, {
      ...IMPORT_LIMITS,
      maxFileSize: 128,
      maxTotalUncompressedSize: 32,
    })

    expect(result).toMatchObject({
      ok: false,
      issue: { code: 'TOTAL_SIZE_EXCEEDED', file: 'assets/blob.bin' },
    })
  })

  it('refuse un ratio de compression de type ZIP bomb', () => {
    const archive = zipSync({ 'assets/bomb.bin': new Uint8Array(4096) }, { level: 9 })
    const result = readZipArchive(archive, {
      ...IMPORT_LIMITS,
      compressionRatioMinimumSize: 1,
      maxCompressionRatio: 2,
    })

    expect(result).toMatchObject({
      ok: false,
      issue: { code: 'COMPRESSION_RATIO_EXCEEDED', file: 'assets/bomb.bin' },
    })
  })

  it('réutilise le refus des URL javascript:', async () => {
    await expectImportIssue(
      await createPackageArchive({
        manifest: { id: dangerousUrl.id },
        travel: dangerousUrl,
      }),
      {
        code: 'UNSUPPORTED_URL_PROTOCOL',
        file: 'voyage.json',
        field: '/places/0/links/0/url',
      },
    )
  })

  it('refuse une ressource exécutable déclarée', async () => {
    const script = strToU8('alert(1)')
    await expectImportIssue(
      await createPackageArchive({
        includeDefaultResource: false,
        manifest: {
          resources: [{
            id: 'active-script',
            path: 'assets/run.js',
            mediaType: 'application/javascript',
            size: script.length,
            sha256: await sha256Hex(script),
          }],
        },
        extraFiles: { 'assets/run.js': script },
      }),
      {
        code: 'RESOURCE_TYPE_UNSUPPORTED',
        file: 'manifest.json',
        field: '/resources/0/mediaType',
      },
    )
  })

  it('ignore totalement un guide autonome contenant un script', async () => {
    const marker = '__guideStandaloneExecuted'
    delete (globalThis as Record<string, unknown>)[marker]
    const result = await importTravelPackage(
      selectedPackageFile(
        await createPackageArchive({
          guideHtml: `<script>globalThis.${marker}=true</script>`,
        }),
      ),
    )

    expect(result.ok).toBe(true)
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined()
    if (result.ok) {
      expect(result.package.guideStandalonePresent).toBe(true)
      expect(result.package).not.toHaveProperty('guideStandaloneHtml')
    }
  })

  it('n’expose aucun voyage partiel lors d’un échec tardif', async () => {
    const result = await expectImportIssue(
      await createPackageArchive({
        manifest: {
          resources: [{
            id: 'cover-image',
            path: 'assets/cover.png',
            mediaType: 'image/png',
            size: TEST_PNG_BYTES.length,
            sha256: 'f'.repeat(64),
          }],
        },
      }),
      { code: 'RESOURCE_HASH_MISMATCH' },
    )

    expect(result).not.toHaveProperty('travel')
    expect(result).not.toHaveProperty('resources')
  })

  it('normalise explicitement la version externe 1.0.0', () => {
    const result = normalizeTravelDocument('1.0.0', validTravelDocument)

    expect(result).toMatchObject({
      ok: true,
      travel: { id: 'madrid-weekend-2026', contentVersion: '1.0.0' },
    })
  })

  it('normalise explicitement la version externe 1.1.0', () => {
    const result = normalizeTravelDocument(
      '1.1.0',
      validTravelV1_1 as TravelDocumentV1_1,
    )

    expect(result).toMatchObject({
      ok: true,
      travel: {
        id: 'coastal-trip-2026',
        contentVersion: '1.1.0',
        documents: [{ id: 'document-ticket' }],
      },
    })
  })

  it('signale une normalisation impossible sans interprétation approximative', () => {
    const result = normalizeTravelDocument('1.0.0', validTravelDocument, {})

    expect(result).toMatchObject({
      ok: false,
      issue: {
        kind: 'migration',
        code: 'MIGRATION_UNAVAILABLE',
        file: 'voyage.json',
        field: '/contentModelVersion',
      },
    })
  })

  it('refuse un fichier qui n’est pas déclaré comme ZIP', async () => {
    const archive = await createPackageArchive()
    const result = await importTravelPackage(
      selectedPackageFile(archive, { name: 'voyage.txt', type: 'text/plain' }),
    )

    expect(result).toMatchObject({
      ok: false,
      kind: 'validation',
      errors: [{ code: 'FILE_TYPE_UNSUPPORTED', file: 'voyage.txt' }],
    })
  })
})
