import schema from '../../../../contracts/voyage/1.3.0/schema.json'
import {
  createTravelSchemaValidator,
  type ContractValidationResult,
} from '../schemaValidation'
import type { TravelDocumentV1_3 } from './document'

export type TravelContractValidationResultV1_3 =
  ContractValidationResult<TravelDocumentV1_3>

export const validateTravelDocumentSchemaV1_3 =
  createTravelSchemaValidator<TravelDocumentV1_3>(schema)
