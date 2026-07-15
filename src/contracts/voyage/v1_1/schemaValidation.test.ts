import { describe, expect, it } from 'vitest'
import validTravel from '../../../../examples/voyage/1.1.0/valid/coastal-trip.json'
import unknownProperty from '../../../../examples/voyage/1.1.0/invalid/unknown-property.json'
import { validateTravelDocumentSchemaV1_1 } from './schemaValidation'

describe('contrat voyage.json 1.1.0', () => {
  it('accepte documents, réservations et associations optionnelles', () => {
    const result = validateTravelDocumentSchemaV1_1(validTravel)

    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error(JSON.stringify(result.issues))
    expect(result.document.documents?.[0]?.resourceId).toBe('pdf-ferry-ticket')
    expect(result.document.days[0]?.steps[0]?.reservationIds).toEqual([
      'reservation-ferry',
    ])
  })

  it('accepte leur absence et conserve des collections réellement optionnelles', () => {
    const withoutOptional: Record<string, unknown> = structuredClone(validTravel)
    delete withoutOptional.documents
    delete withoutOptional.reservations
    const result = validateTravelDocumentSchemaV1_1(withoutOptional)

    expect(result.valid).toBe(true)
  })

  it('refuse toute propriété inconnue ou tentative de HTML actif', () => {
    const result = validateTravelDocumentSchemaV1_1(unknownProperty)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Le document aurait dû être refusé.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'SCHEMA_UNKNOWN_PROPERTY',
      path: '/documents/0/html',
    }))
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'FORBIDDEN_PRESENTATION_FIELD',
      path: '/documents/0/html',
    }))
  })

  it('applique les formats de date et d’heure aux réservations', () => {
    const invalid = {
      ...validTravel,
      reservations: [{
        ...validTravel.reservations[0],
        date: '2026-02-30',
        time: '28:15',
      }],
    }
    const result = validateTravelDocumentSchemaV1_1(invalid)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('La réservation aurait dû être refusée.')
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SCHEMA_FORMAT', path: '/reservations/0/date' }),
      expect.objectContaining({ code: 'SCHEMA_PATTERN', path: '/reservations/0/time' }),
    ]))
  })

  it('refuse les associations dupliquées dans un même contexte', () => {
    const invalid = {
      ...validTravel,
      days: [{
        ...validTravel.days[0],
        documentIds: ['document-ticket', 'document-ticket'],
      }],
    }
    const result = validateTravelDocumentSchemaV1_1(invalid)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('La référence dupliquée aurait dû être refusée.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'SCHEMA_INVALID',
      path: '/days/0/documentIds',
    }))
  })
})
