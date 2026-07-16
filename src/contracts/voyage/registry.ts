import type { TravelDocumentV1 } from './v1/document'
import { validateTravelDocumentSchema } from './v1/schemaValidation'
import type { TravelDocumentV1_1 } from './v1_1/document'
import { validateTravelDocumentSchemaV1_1 } from './v1_1/schemaValidation'
import type { ContractValidationResult } from './schemaValidation'
import type { TravelDocumentV1_2 } from './v1_2/document'
import { validateTravelDocumentSchemaV1_2 } from './v1_2/schemaValidation'
import type { TravelDocumentV1_3 } from './v1_3/document'
import { validateTravelDocumentSchemaV1_3 } from './v1_3/schemaValidation'

export type SupportedTravelDocument = TravelDocumentV1 | TravelDocumentV1_1 | TravelDocumentV1_2 | TravelDocumentV1_3

export const SUPPORTED_TRAVEL_CONTENT_VERSIONS = ['1.0.0', '1.1.0', '1.2.0', '1.3.0'] as const

export function validateTravelDocumentForVersion(
  version: string,
  input: unknown,
): ContractValidationResult<SupportedTravelDocument> {
  if (version === '1.0.0') return validateTravelDocumentSchema(input)
  if (version === '1.1.0') return validateTravelDocumentSchemaV1_1(input)
  if (version === '1.2.0') return validateTravelDocumentSchemaV1_2(input)
  if (version === '1.3.0') return validateTravelDocumentSchemaV1_3(input)
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
