import schema from '../../../../contracts/voyage/1.1.0/schema.json'
import {
  createTravelSchemaValidator,
  type ContractValidationResult,
} from '../schemaValidation'
import type { TravelDocumentV1_1 } from './document'

export type TravelContractValidationResultV1_1 =
  ContractValidationResult<TravelDocumentV1_1>

export const validateTravelDocumentSchemaV1_1 =
  createTravelSchemaValidator<TravelDocumentV1_1>(schema)
