import schema from '../../../../contracts/voyage/1.2.0/schema.json'
import {
  createTravelSchemaValidator,
  type ContractValidationResult,
} from '../schemaValidation'
import type { TravelDocumentV1_2 } from './document'

export type TravelContractValidationResultV1_2 =
  ContractValidationResult<TravelDocumentV1_2>

export const validateTravelDocumentSchemaV1_2 =
  createTravelSchemaValidator<TravelDocumentV1_2>(schema)
