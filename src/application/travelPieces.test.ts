import { describe, expect, it } from 'vitest'
import type { Travel, TravelDay } from '../domain/voyage/model'
import { consultationTravel } from '../ui/travel/testFixtures'
import {
  allDocumentsStoredLocally,
  documentPiecesForStep,
  findStepWithDay,
  groupTravelPiecesByDay,
  listTravelPieces,
  piecesForDay,
  type TravelPieceAttachment,
} from './travelPieces'

function attachmentKeys(attachments: readonly TravelPieceAttachment[]) {
  return attachments.map((attachment) => (
    attachment.type === 'day'
      ? `day:${attachment.day.id}`
      : `step:${attachment.step.id}`
  ))
}

function travelWith(overrides: Partial<Travel>): Travel {
  return { ...consultationTravel, ...overrides }
}

const bareDay: TravelDay = {
  id: 'day-bare',
  date: '2026-07-17',
  title: 'Assurance annulation',
  steps: [],
  documentIds: [],
  reservationIds: [],
  illustrationIds: [],
}

describe('pièces du voyage', () => {
  it('rattache chaque pièce une seule fois, par identifiants, à ses journées et étapes', () => {
    const pieces = listTravelPieces(consultationTravel)

    expect(pieces.map((piece) => `${piece.kind}:${piece.id}`)).toEqual([
      'document:document-booking',
      'reservation:reservation-stay',
    ])
    pieces.forEach((piece) => {
      expect(piece.origin).toBe('package')
      expect(attachmentKeys(piece.attachments)).toEqual([
        'step:step-check-in',
        'day:day-harbour',
      ])
    })
  })

  it('regroupe une pièce sous sa première journée sans la répéter ailleurs', () => {
    const groups = groupTravelPiecesByDay(
      consultationTravel,
      listTravelPieces(consultationTravel),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ type: 'day', day: { id: 'day-arrival' } })
    expect(groups[0]?.pieces).toHaveLength(2)
  })

  it('range les pièces sans rattachement dans « Tout le voyage », en premier', () => {
    const travel = travelWith({
      documents: [
        ...consultationTravel.documents,
        {
          id: 'document-insurance',
          label: 'Assurance annulation',
          resourceId: 'pdf-insurance',
        },
      ],
      days: [...consultationTravel.days, bareDay],
    })

    const pieces = listTravelPieces(travel)
    const groups = groupTravelPiecesByDay(travel, pieces)
    const insurance = pieces.find((piece) => piece.id === 'document-insurance')

    // Le libellé identique au titre d’une journée ne crée aucun rattachement.
    expect(insurance?.attachments).toEqual([])
    expect(groups.map((group) => (
      group.type === 'travel' ? 'travel' : group.day.id
    ))).toEqual(['travel', 'day-arrival'])
    expect(groups[0]?.pieces.map((piece) => piece.id)).toEqual(['document-insurance'])
  })

  it('fait hériter un document des rattachements de la réservation qui le référence', () => {
    const travel = travelWith({
      days: consultationTravel.days.map((day) => ({
        ...day,
        documentIds: [],
        steps: day.steps.map((step) => ({ ...step, documentIds: [] })),
      })),
    })

    const document = listTravelPieces(travel).find((piece) => piece.kind === 'document')

    expect(attachmentKeys(document?.attachments ?? [])).toEqual([
      'step:step-check-in',
      'day:day-harbour',
    ])
  })

  it('ordonne les pièces selon le programme, puis selon le dossier', () => {
    const travel = travelWith({
      days: consultationTravel.days.map((day) => (
        day.id === 'day-island'
          ? { ...day, steps: [{ ...day.steps[0]!, documentIds: ['document-ferry'] }] }
          : day.id === 'day-arrival'
            ? { ...day, documentIds: ['document-market'] }
            : day
      )),
      documents: [
        { id: 'document-ferry', label: 'Billet bateau', resourceId: 'pdf-ferry' },
        ...consultationTravel.documents,
        { id: 'document-market', label: 'Plan du marché', resourceId: 'pdf-market' },
      ],
    })

    expect(listTravelPieces(travel).map((piece) => piece.id)).toEqual([
      'document-market',
      'document-booking',
      'reservation-stay',
      'document-ferry',
    ])
  })

  it('ne produit aucune section pour un voyage sans document ni réservation', () => {
    const travel = travelWith({ documents: [], reservations: [] })

    expect(listTravelPieces(travel)).toEqual([])
    expect(groupTravelPiecesByDay(travel, [])).toEqual([])
  })

  it('n’annonce la disponibilité locale que si chaque PDF est présent', () => {
    expect(allDocumentsStoredLocally(consultationTravel, new Set(['pdf-booking']))).toBe(true)
    expect(allDocumentsStoredLocally(consultationTravel, new Set(['pdf-other']))).toBe(false)
    expect(allDocumentsStoredLocally(
      travelWith({ documents: [] }),
      new Set(['pdf-booking']),
    )).toBe(false)
  })

  it('sélectionne les pièces d’une journée, qu’elles visent la journée ou une étape', () => {
    const pieces = listTravelPieces(consultationTravel)

    expect(piecesForDay(pieces, 'day-arrival').map((piece) => piece.id))
      .toEqual(['document-booking', 'reservation-stay'])
    expect(piecesForDay(pieces, 'day-harbour')).toHaveLength(2)
    expect(piecesForDay(pieces, 'day-island')).toEqual([])
  })

  it('liste les documents d’une étape, y compris ceux de ses réservations', () => {
    const travel = travelWith({
      days: consultationTravel.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) => ({ ...step, documentIds: [] })),
      })),
    })

    expect(documentPiecesForStep(listTravelPieces(travel), 'step-check-in')
      .map((piece) => piece.document.id)).toEqual(['document-booking'])
    expect(documentPiecesForStep(listTravelPieces(travel), 'step-market')).toEqual([])
  })

  it('retrouve une étape et sa journée par identifiant', () => {
    expect(findStepWithDay(consultationTravel, 'step-ferry')).toMatchObject({
      day: { id: 'day-island' },
      step: { id: 'step-ferry' },
    })
    expect(findStepWithDay(consultationTravel, 'step-missing')).toBeUndefined()
  })
})
