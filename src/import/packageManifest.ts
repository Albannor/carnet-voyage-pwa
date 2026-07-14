export const PACKAGE_FORMAT_VERSION = '1.0.0' as const

export type PackageFormatVersion = typeof PACKAGE_FORMAT_VERSION

export const ALLOWED_RESOURCE_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const

export type AllowedResourceMediaType =
  (typeof ALLOWED_RESOURCE_MEDIA_TYPES)[number]

export interface PackageResourceDocument {
  id: string
  path: string
  mediaType: AllowedResourceMediaType
  size: number
  sha256: string
}

export interface PackageManifestV1 {
  packageFormatVersion: PackageFormatVersion
  id: string
  travelModelVersion: string
  travelPath: 'voyage.json'
  allowUndeclaredFiles: false
  resources: PackageResourceDocument[]
}
