import { describe, expect, it } from 'vitest'
import validTravel from '../../../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import invalidDate from '../../../../examples/voyage/1.0.0/invalid/invalid-date.json'
import missingTitle from '../../../../examples/voyage/1.0.0/invalid/missing-required-title.json'
import presentationCode from '../../../../examples/voyage/1.0.0/invalid/presentation-code.json'
import unknownProperty from '../../../../examples/voyage/1.0.0/invalid/unknown-property.json'
import { validateTravelDocumentSchema } from './schemaValidation'

function expectIssue(
  input: unknown,
  expected: { code: string; path: string },
) {
  const result = validateTravelDocumentSchema(input)

  expect(result.valid).toBe(false)
  if (result.valid) {
    throw new Error('Le document aurait dû être refusé par le contrat.')
  }

  expect(result.issues).toContainEqual(expect.objectContaining(expected))
}

describe('contrat voyage.json 1.0.0', () => {
  it('accepte l’exemple représentatif valide', () => {
    const result = validateTravelDocumentSchema(validTravel)

    expect(result.valid).toBe(true)
    if (!result.valid) {
      throw new Error(JSON.stringify(result.issues))
    }
    expect(result.document.contentModelVersion).toBe('1.0.0')
  })

  it('refuse une version de contenu différente du contrat sélectionné', () => {
    expectIssue({ ...validTravel, contentModelVersion: '2.0.0' }, {
      code: 'SCHEMA_CONST',
      path: '/contentModelVersion',
    })
  })

  it('identifie précisément un champ obligatoire absent', () => {
    expectIssue(missingTitle, {
      code: 'SCHEMA_REQUIRED',
      path: '/title',
    })
  })

  it('refuse une date ISO impossible', () => {
    expectIssue(invalidDate, {
      code: 'SCHEMA_FORMAT',
      path: '/startDate',
    })
  })

  it('contrôle la forme des identifiants stables', () => {
    expectIssue({ ...validTravel, id: 'Voyage Madrid' }, {
      code: 'SCHEMA_PATTERN',
      path: '/id',
    })
  })

  it('contrôle les codes de langue documentés', () => {
    expectIssue({ ...validTravel, language: 'fr_fr' }, {
      code: 'SCHEMA_PATTERN',
      path: '/language',
    })
  })

  it('contrôle les heures locales sur 24 heures', () => {
    const invalidTime = {
      ...validTravel,
      days: [
        {
          ...validTravel.days[0],
          steps: [{ ...validTravel.days[0].steps[0], startTime: '25:30' }],
        },
      ],
    }

    expectIssue(invalidTime, {
      code: 'SCHEMA_PATTERN',
      path: '/days/0/steps/0/startTime',
    })
  })

  it('refuse les propriétés inconnues', () => {
    expectIssue(unknownProperty, {
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/theme',
    })
  })

  it('refuse une valeur de variante non prévue par le contrat', () => {
    const invalidVariant = {
      ...validTravel,
      variants: [{ ...validTravel.variants[0], kind: 'sunny' }],
    }

    expectIssue(invalidVariant, {
      code: 'SCHEMA_ENUM',
      path: '/variants/0/kind',
    })
  })

  it('signale explicitement les tentatives de règle de rendu et de code actif', () => {
    expectIssue(presentationCode, {
      code: 'FORBIDDEN_PRESENTATION_FIELD',
      path: '/days/0/steps/0/component',
    })
    expectIssue(presentationCode, {
      code: 'FORBIDDEN_PRESENTATION_FIELD',
      path: '/days/0/steps/0/script',
    })
  })
})
