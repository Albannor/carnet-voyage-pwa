import { describe, expect, it } from 'vitest'
import validTravel from '../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import unknownProperty from '../../examples/voyage/1.0.0/invalid/unknown-property.json'
import { validateTravelDocument } from './validateTravelDocument'

describe('validation complète d’un document voyage', () => {
  it('produit le modèle interne après les validations du contrat et du domaine', () => {
    const result = validateTravelDocument(validTravel)

    expect(result.valid).toBe(true)
    if (!result.valid) {
      throw new Error(JSON.stringify(result.issues))
    }

    expect(result.travel).toMatchObject({
      id: 'madrid-weekend-2026',
      contentVersion: '1.0.0',
      locale: 'fr-FR',
      period: {
        start: '2026-11-13',
        end: '2026-11-15',
      },
    })
    expect(result.travel.places[0]?.links[0]?.href).toMatch(/^https:/)
  })

  it('ne construit pas de modèle interne lorsque le contrat est invalide', () => {
    const result = validateTravelDocument(unknownProperty)

    expect(result.valid).toBe(false)
    if (result.valid) {
      throw new Error('Le document invalide ne doit pas produire de modèle.')
    }
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'SCHEMA_UNKNOWN_PROPERTY',
        path: '/theme',
      }),
    )
  })
})
