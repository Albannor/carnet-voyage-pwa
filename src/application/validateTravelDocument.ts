import { validateTravelDocumentForVersion } from '../contracts/voyage/registry'
import type { Travel } from '../domain/voyage/model'
import {
  validateTravel,
  type DomainValidationIssue,
} from '../domain/voyage/validation'
import type { ContractValidationIssue } from '../contracts/voyage/v1/schemaValidation'
import { normalizeTravelDocument } from '../import/migrations/registry'

export type TravelDocumentValidationIssue =
  | ContractValidationIssue
  | DomainValidationIssue

export type TravelDocumentValidationResult =
  | {
      valid: true
      travel: Travel
      issues: []
    }
  | {
      valid: false
      issues: TravelDocumentValidationIssue[]
    }

export function validateTravelDocument(
  input: unknown,
): TravelDocumentValidationResult {
  const version =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>).contentModelVersion
      : undefined
  const contractResult = validateTravelDocumentForVersion(
    typeof version === 'string' ? version : '',
    input,
  )

  if (!contractResult.valid) {
    return contractResult
  }

  const normalized = normalizeTravelDocument(
    typeof version === 'string' ? version : '',
    contractResult.document,
  )
  if (!normalized.ok) {
    return {
      valid: false,
      issues: [{
        source: 'schema',
        code: 'SCHEMA_CONST',
        path: '/contentModelVersion',
        message: normalized.issue.message,
      }],
    }
  }
  const travel = normalized.travel
  const issues = validateTravel(travel)

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, travel, issues: [] }
}
