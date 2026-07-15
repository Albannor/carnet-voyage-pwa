import Ajv2020, { type ErrorObject, type AnySchema } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

export type ContractIssueCode =
  | 'FORBIDDEN_PRESENTATION_FIELD'
  | 'SCHEMA_CONST'
  | 'SCHEMA_ENUM'
  | 'SCHEMA_FORMAT'
  | 'SCHEMA_INVALID'
  | 'SCHEMA_MIN_ITEMS'
  | 'SCHEMA_PATTERN'
  | 'SCHEMA_REQUIRED'
  | 'SCHEMA_TYPE'
  | 'SCHEMA_UNKNOWN_PROPERTY'

export interface ContractValidationIssue {
  source: 'policy' | 'schema'
  code: ContractIssueCode
  path: string
  message: string
}

export type ContractValidationResult<TDocument> =
  | { valid: true; document: TDocument; issues: [] }
  | { valid: false; issues: ContractValidationIssue[] }

const forbiddenPropertyNames = new Set([
  'component',
  'css',
  'dangerouslySetInnerHTML',
  'html',
  'onClick',
  'render',
  'script',
  'style',
  'template',
])

function escapeJsonPointerSegment(segment: string) {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

function findForbiddenPresentationFields(
  value: unknown,
  path = '',
): ContractValidationIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenPresentationFields(item, `${path}/${index}`),
    )
  }
  if (value === null || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = `${path}/${escapeJsonPointerSegment(key)}`
    const issues: ContractValidationIssue[] = forbiddenPropertyNames.has(key)
      ? [{
          source: 'policy',
          code: 'FORBIDDEN_PRESENTATION_FIELD',
          path: childPath,
          message: `La propriété « ${key} » tente d'introduire une règle de rendu ou du code actif.`,
        }]
      : []
    return [...issues, ...findForbiddenPresentationFields(child, childPath)]
  })
}

function schemaIssueCode(keyword: string): ContractIssueCode {
  const codes: Record<string, ContractIssueCode> = {
    additionalProperties: 'SCHEMA_UNKNOWN_PROPERTY',
    const: 'SCHEMA_CONST',
    enum: 'SCHEMA_ENUM',
    format: 'SCHEMA_FORMAT',
    minItems: 'SCHEMA_MIN_ITEMS',
    pattern: 'SCHEMA_PATTERN',
    required: 'SCHEMA_REQUIRED',
    type: 'SCHEMA_TYPE',
  }
  return codes[keyword] ?? 'SCHEMA_INVALID'
}

function schemaIssuePath(error: ErrorObject) {
  const parameters = error.params as Record<string, unknown>
  const property =
    error.keyword === 'required'
      ? parameters.missingProperty
      : error.keyword === 'additionalProperties'
        ? parameters.additionalProperty
        : undefined
  return typeof property === 'string'
    ? `${error.instancePath}/${escapeJsonPointerSegment(property)}`
    : error.instancePath || '/'
}

function toSchemaIssue(error: ErrorObject): ContractValidationIssue {
  return {
    source: 'schema',
    code: schemaIssueCode(error.keyword),
    path: schemaIssuePath(error),
    message: error.message ?? 'La donnée ne respecte pas le schéma JSON.',
  }
}

export function createTravelSchemaValidator<TDocument>(schema: AnySchema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const validateSchema = ajv.compile(schema)

  return (input: unknown): ContractValidationResult<TDocument> => {
    const policyIssues = findForbiddenPresentationFields(input)
    const schemaValid = validateSchema(input)
    const schemaIssues = schemaValid
      ? []
      : (validateSchema.errors ?? []).map(toSchemaIssue)
    const issues = [...policyIssues, ...schemaIssues]

    return issues.length > 0 || !schemaValid
      ? { valid: false, issues }
      : { valid: true, document: input as TDocument, issues: [] }
  }
}
