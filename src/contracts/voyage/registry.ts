import type { TravelDocumentV1 } from './v1/document'
import { validateTravelDocumentSchema } from './v1/schemaValidation'
import type { TravelDocumentV1_1 } from './v1_1/document'
import { validateTravelDocumentSchemaV1_1 } from './v1_1/schemaValidation'
import type { ContractValidationResult } from './schemaValidation'

export type SupportedTravelDocument = TravelDocumentV1 | TravelDocumentV1_1

export const SUPPORTED_TRAVEL_CONTENT_VERSIONS = ['1.0.0', '1.1.0'] as const

export function validateTravelDocumentForVersion(
  version: string,
  input: unknown,
): ContractValidationResult<SupportedTravelDocument> {
  if (version === '1.0.0') return validateTravelDocumentSchema(input)
  if (version === '1.1.0') return validateTravelDocumentSchemaV1_1(input)
  return {
    valid: false,
    issues: [{
      source: 'schema',
      code: 'SCHEMA_CONST',
      path: '/contentModelVersion',
      message: `La version de contenu « ${version} » n'est pas prise en charge.`,
    }],
  }
}
