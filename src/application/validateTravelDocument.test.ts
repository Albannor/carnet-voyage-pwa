import { describe, expect, it } from 'vitest'
import validTravel from '../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import unknownProperty from '../../examples/voyage/1.0.0/invalid/unknown-property.json'
import validTravelV1_1 from '../../examples/voyage/1.1.0/valid/coastal-trip.json'
import dangerousReservationUrl from '../../examples/voyage/1.1.0/invalid/dangerous-reservation-url.json'
import unknownDocumentReference from '../../examples/voyage/1.1.0/invalid/unknown-document-reference.json'
import duplicateDocumentId from '../../examples/voyage/1.1.0/invalid/duplicate-document-id.json'
import unknownReservationReference from '../../examples/voyage/1.1.0/invalid/unknown-reservation-reference.json'
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

  it('normalise voyage.json 1.0.0 avec les nouvelles collections vides', () => {
    const result = validateTravelDocument(validTravel)

    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error(JSON.stringify(result.issues))
    expect(result.travel.documents).toEqual([])
    expect(result.travel.reservations).toEqual([])
    expect(result.travel.days[0]?.documentIds).toEqual([])
    expect(result.travel.days[0]?.steps[0]?.reservationIds).toEqual([])
  })

  it('normalise voyage.json 1.1.0 avec documents et réservations', () => {
    const result = validateTravelDocument(validTravelV1_1)

    expect(result.valid).toBe(true)
    if (!result.valid) throw new Error(JSON.stringify(result.issues))
    expect(result.travel).toMatchObject({
      contentVersion: '1.1.0',
      documents: [{ id: 'document-ticket', resourceId: 'pdf-ferry-ticket' }],
      reservations: [{ id: 'reservation-ferry' }],
    })
  })

  it('refuse une association vers un document inconnu', () => {
    const result = validateTravelDocument(unknownDocumentReference)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('La référence aurait dû être refusée.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_DOCUMENT_REFERENCE',
      path: '/days/0/documentIds/0',
    }))
  })

  it('refuse une URL active dans une réservation', () => {
    const result = validateTravelDocument(dangerousReservationUrl)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error("L'URL aurait dû être refusée.")
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'UNSUPPORTED_URL_PROTOCOL',
      path: '/reservations/0/links/0/url',
    }))
  })

  it('refuse un identifiant de document dupliqué', () => {
    const result = validateTravelDocument(duplicateDocumentId)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Le doublon aurait dû être refusé.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_ID',
      path: '/documents/1/id',
    }))
  })

  it('refuse une association vers une réservation inconnue', () => {
    const result = validateTravelDocument(unknownReservationReference)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('La référence aurait dû être refusée.')
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'UNKNOWN_RESERVATION_REFERENCE',
      path: '/days/0/reservationIds/0',
    }))
  })
})
