import { describe, expect, it } from 'vitest'
import validTravel from '../../examples/voyage/1.3.0/valid/illustrated-coast.json'
import { importTravelPackage } from './importTravelPackage'
import { sha256Hex } from './sha256'
import {
  TEST_JPEG_BYTES,
  TEST_PDF_BYTES,
  TEST_PNG_BYTES,
  TEST_WEBP_BYTES,
  createPackageArchive,
  selectedPackageFile,
} from './test/packageFixtures'

const imageFixtures = [
  ['image/png', 'assets/cover.png', TEST_PNG_BYTES],
  ['image/jpeg', 'assets/day.jpg', TEST_JPEG_BYTES],
  ['image/webp', 'assets/step.webp', TEST_WEBP_BYTES],
] as const

async function illustratedArchive(
  overrides: {
    travel?: unknown
    resources?: Array<{
      id: string
      path: string
      mediaType: string
      size: number
      sha256: string
    }>
    files?: Record<string, Uint8Array>
  } = {},
) {
  const resources = overrides.resources ?? await Promise.all(
    imageFixtures.map(async ([mediaType, path, bytes], index) => ({
      id: ['image-cover', 'image-day', 'image-step'][index]!,
      path,
      mediaType,
      size: bytes.length,
      sha256: await sha256Hex(bytes),
    })),
  )
  return createPackageArchive({
    includeDefaultResource: false,
    travel: overrides.travel ?? validTravel,
    manifest: {
      id: validTravel.id,
      travelModelVersion: '1.3.0',
      resources,
    },
    extraFiles: overrides.files ?? Object.fromEntries(
      imageFixtures.map(([, path, bytes]) => [path, bytes]),
    ),
  })
}

describe('import des illustrations 1.3.0', () => {
  it('importe des ressources PNG, JPEG et WebP validées', async () => {
    const result = await importTravelPackage(
      selectedPackageFile(await illustratedArchive()),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.package.travel.illustrations).toHaveLength(3)
    expect(result.package.resources.map((resource) => resource.mediaType))
      .toEqual(['image/png', 'image/jpeg', 'image/webp'])
  })

  it('refuse une ressource d’illustration absente', async () => {
    const resources = await Promise.all(imageFixtures.slice(0, 2).map(
      async ([mediaType, path, bytes], index) => ({
        id: ['image-cover', 'image-day'][index]!,
        path,
        mediaType,
        size: bytes.length,
        sha256: await sha256Hex(bytes),
      }),
    ))
    const result = await importTravelPackage(selectedPackageFile(
      await illustratedArchive({
        resources,
        files: Object.fromEntries(imageFixtures.slice(0, 2).map(
          ([, path, bytes]) => [path, bytes],
        )),
      }),
    ))
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: 'ILLUSTRATION_RESOURCE_UNKNOWN',
          field: '/illustrations/2/resourceId',
        }),
      ]),
    }))
  })

  it('refuse un PDF utilisé comme illustration', async () => {
    const travel = structuredClone(validTravel)
    travel.illustrations = [travel.illustrations[0]!]
    travel.illustrations[0]!.resourceId = 'resource-pdf'
    travel.coverIllustrationId = 'cover-photo'
    travel.days[0]!.illustrationIds = []
    travel.days[0]!.steps[0]!.illustrationIds = []
    const resources = [{
      id: 'resource-pdf',
      path: 'documents/image.pdf',
      mediaType: 'application/pdf',
      size: TEST_PDF_BYTES.length,
      sha256: await sha256Hex(TEST_PDF_BYTES),
    }]
    const result = await importTravelPackage(selectedPackageFile(
      await illustratedArchive({
        travel,
        resources,
        files: { 'documents/image.pdf': TEST_PDF_BYTES },
      }),
    ))
    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'ILLUSTRATION_RESOURCE_NOT_IMAGE' }),
      ]),
    }))
  })

  it('préserve les contrôles de signature et de hash', async () => {
    const invalidPng = new Uint8Array(TEST_PNG_BYTES.length).fill(0x41)
    const resources = await Promise.all(imageFixtures.map(
      async ([mediaType, path, bytes], index) => ({
        id: ['image-cover', 'image-day', 'image-step'][index]!,
        path,
        mediaType,
        size: index === 0 ? invalidPng.length : bytes.length,
        sha256: await sha256Hex(index === 0 ? invalidPng : bytes),
      }),
    ))
    const signatureResult = await importTravelPackage(selectedPackageFile(
      await illustratedArchive({
        resources,
        files: {
          'assets/cover.png': invalidPng,
          'assets/day.jpg': TEST_JPEG_BYTES,
          'assets/step.webp': TEST_WEBP_BYTES,
        },
      }),
    ))
    expect(signatureResult).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'RESOURCE_CONTENT_MISMATCH' }),
      ]),
    }))

    const badHashResources = await Promise.all(imageFixtures.map(
      async ([mediaType, path, bytes], index) => ({
        id: ['image-cover', 'image-day', 'image-step'][index]!,
        path,
        mediaType,
        size: bytes.length,
        sha256: index === 0 ? '0'.repeat(64) : await sha256Hex(bytes),
      }),
    ))
    const hashResult = await importTravelPackage(selectedPackageFile(
      await illustratedArchive({ resources: badHashResources }),
    ))
    expect(hashResult).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'RESOURCE_HASH_MISMATCH' }),
      ]),
    }))
  })
})
