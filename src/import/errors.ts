import type { ContractIssueCode } from '../contracts/voyage/v1/schemaValidation'
import type { DomainIssueCode } from '../domain/voyage/validation'

export type ImportFailureKind =
  | 'validation'
  | 'incompatible-version'
  | 'limit'
  | 'corrupt-archive'
  | 'resource'
  | 'migration'

export type PackageImportErrorCode =
  | 'ARCHIVE_CORRUPTED'
  | 'ARCHIVE_EMPTY'
  | 'ARCHIVE_ENCRYPTED'
  | 'ARCHIVE_UNSUPPORTED'
  | 'COMPRESSION_RATIO_EXCEEDED'
  | 'FILE_COUNT_EXCEEDED'
  | 'FILE_SIZE_EXCEEDED'
  | 'FILE_TYPE_UNSUPPORTED'
  | 'JSON_INVALID'
  | 'MANIFEST_SCHEMA_INVALID'
  | 'MANIFEST_TOO_LARGE'
  | 'MIGRATION_FAILED'
  | 'MIGRATION_UNAVAILABLE'
  | 'PACKAGE_ID_MISMATCH'
  | 'PACKAGE_VERSION_UNSUPPORTED'
  | 'PATH_ABSOLUTE'
  | 'PATH_CASE_COLLISION'
  | 'PATH_DUPLICATE'
  | 'PATH_INVALID_SEPARATOR'
  | 'PATH_NOT_NORMALIZED'
  | 'PATH_TRAVERSAL'
  | 'PATH_TOO_DEEP'
  | 'PATH_TOO_LONG'
  | 'REQUIRED_FILE_MISSING'
  | 'RESOURCE_CONTENT_MISMATCH'
  | 'DOCUMENT_RESOURCE_NOT_PDF'
  | 'DOCUMENT_RESOURCE_UNKNOWN'
  | 'RESOURCE_HASH_MISMATCH'
  | 'RESOURCE_ID_DUPLICATE'
  | 'RESOURCE_MISSING'
  | 'RESOURCE_PATH_DUPLICATE'
  | 'RESOURCE_SIZE_MISMATCH'
  | 'RESOURCE_TYPE_UNSUPPORTED'
  | 'RESOURCE_UNDECLARED'
  | 'TOTAL_SIZE_EXCEEDED'
  | 'TRAVEL_TOO_LARGE'
  | 'TRAVEL_VERSION_MISMATCH'
  | 'TRAVEL_VERSION_UNSUPPORTED'

export type ImportErrorCode =
  | PackageImportErrorCode
  | ContractIssueCode
  | DomainIssueCode

export interface ImportIssue {
  readonly kind: ImportFailureKind
  readonly code: ImportErrorCode
  readonly message: string
  readonly file?: string
  readonly field?: string
  readonly hint: string
}

export function importIssue(
  kind: ImportFailureKind,
  code: ImportErrorCode,
  message: string,
  context: {
    file?: string
    field?: string
    hint: string
  },
): ImportIssue {
  return { kind, code, message, ...context }
}
