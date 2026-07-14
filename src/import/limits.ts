export interface ImportLimits {
  readonly maxZipSize: number
  readonly maxTotalUncompressedSize: number
  readonly maxFileSize: number
  readonly maxFileCount: number
  readonly maxPathDepth: number
  readonly maxPathLength: number
  readonly maxCompressionRatio: number
  readonly compressionRatioMinimumSize: number
  readonly maxManifestSize: number
  readonly maxTravelSize: number
}

const MEBIBYTE = 1024 * 1024

export const IMPORT_LIMITS: ImportLimits = Object.freeze({
  maxZipSize: 25 * MEBIBYTE,
  maxTotalUncompressedSize: 75 * MEBIBYTE,
  maxFileSize: 20 * MEBIBYTE,
  maxFileCount: 120,
  maxPathDepth: 5,
  maxPathLength: 180,
  maxCompressionRatio: 100,
  compressionRatioMinimumSize: 1024,
  maxManifestSize: 128 * 1024,
  maxTravelSize: 2 * MEBIBYTE,
})
