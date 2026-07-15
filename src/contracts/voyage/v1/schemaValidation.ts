import schema from '../../../../contracts/voyage/1.0.0/schema.json'
import {
  createTravelSchemaValidator,
  type ContractIssueCode,
  type ContractValidationIssue,
  type ContractValidationResult,
} from '../schemaValidation'
import type { TravelDocumentV1 } from './document'

export type { ContractIssueCode, ContractValidationIssue }
export type TravelContractValidationResult = ContractValidationResult<TravelDocumentV1>

export const validateTravelDocumentSchema =
  createTravelSchemaValidator<TravelDocumentV1>(schema)
