import { strToU8, zipSync } from 'fflate'
import validTravel from '../../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import type { SelectedPackageFile } from '../importTravelPackage'
import { sha256Hex } from '../sha256'

export const TEST_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
])

interface PackageFixtureOptions {
  manifest?: Record<string, unknown>
  travel?: unknown
  omit?: readonly string[]
  extraFiles?: Readonly<Record<string, Uint8Array | string>>
  includeDefaultResource?: boolean
  guideHtml?: string
}

function jsonBytes(value: unknown) {
  return strToU8(JSON.stringify(value))
}

export async function createPackageArchive(
  options: PackageFixtureOptions = {},
) {
  const includeDefaultResource = options.includeDefaultResource ?? true
  const defaultHash = await sha256Hex(TEST_PNG_BYTES)
  const manifest = {
    packageFormatVersion: '1.0.0',
    id: 'madrid-weekend-2026',
    travelModelVersion: '1.0.0',
    travelPath: 'voyage.json',
    allowUndeclaredFiles: false,
    resources: includeDefaultResource
      ? [
          {
            id: 'cover-image',
            path: 'assets/cover.png',
            mediaType: 'image/png',
            size: TEST_PNG_BYTES.length,
            sha256: defaultHash,
          },
        ]
      : [],
    ...options.manifest,
  }
  const files: Record<string, Uint8Array> = {
    'manifest.json': jsonBytes(manifest),
    'voyage.json': jsonBytes(options.travel ?? validTravel),
  }

  if (includeDefaultResource) {
    files['assets/cover.png'] = TEST_PNG_BYTES
  }

  if (options.guideHtml !== undefined) {
    files['guide-standalone.html'] = strToU8(options.guideHtml)
  }

  Object.entries(options.extraFiles ?? {}).forEach(([path, content]) => {
    files[path] = typeof content === 'string' ? strToU8(content) : content
  })

  for (const path of options.omit ?? []) {
    delete files[path]
  }

  return zipSync(files, { level: 6 })
}

export function selectedPackageFile(
  bytes: Uint8Array,
  options: { name?: string; type?: string; declaredSize?: number } = {},
): SelectedPackageFile {
  const stableBytes = Uint8Array.from(bytes)

  return {
    name: options.name ?? 'voyage-test.zip',
    type: options.type ?? 'application/zip',
    size: options.declaredSize ?? stableBytes.length,
    async arrayBuffer() {
      return stableBytes.slice().buffer
    },
  }
}
