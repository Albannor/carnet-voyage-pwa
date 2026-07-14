import { validateTravelDocumentSchema } from '../contracts/voyage/v1/schemaValidation'
import { toTravel } from '../contracts/voyage/v1/toTravel'
import type { Travel } from '../domain/voyage/model'
import {
  validateTravel,
  type DomainValidationIssue,
} from '../domain/voyage/validation'
import type { ContractValidationIssue } from '../contracts/voyage/v1/schemaValidation'

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
  const contractResult = validateTravelDocumentSchema(input)

  if (!contractResult.valid) {
    return contractResult
  }

  const travel = toTravel(contractResult.document)
  const issues = validateTravel(travel)

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, travel, issues: [] }
}
