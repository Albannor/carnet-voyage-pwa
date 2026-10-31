import { afterEach, describe, expect, it } from 'vitest'
import { readTravelLocation, writeTravelLocation } from './navigation'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('navigation de consultation dans l’URL', () => {
  it.each([
    ['summary', { kind: 'summary' }],
    ['today', { kind: 'today' }],
    ['pieces', { kind: 'pieces' }],
    ['practical', { kind: 'practical' }],
    ['preparation', { kind: 'preparation' }],
  ] as const)('relit la vue %s', (view, expected) => {
    expect(readTravelLocation(`?travel=travel-test&view=${view}`)).toEqual({
      travelId: 'travel-test',
      view: expected,
    })
  })

  it('relit une journée identifiée explicitement', () => {
    expect(readTravelLocation('?travel=travel-test&view=day&day=day-2')).toEqual({
      travelId: 'travel-test',
      view: { kind: 'day', dayId: 'day-2' },
    })
  })

  it('écrit les sections pratiques et préparation sans contenu métier', () => {
    writeTravelLocation({
      travelId: 'travel-test',
      view: { kind: 'practical' },
    })
    expect(window.location.search).toBe('?travel=travel-test&view=practical')

    writeTravelLocation({
      travelId: 'travel-test',
      view: { kind: 'preparation' },
    }, 'replace')
    expect(window.location.search).toBe('?travel=travel-test&view=preparation')
  })

  it('écrit puis relit une étape identifiée, sans paramètre résiduel', () => {
    writeTravelLocation({ travelId: 'travel-test', view: { kind: 'step', stepId: 'step-1' } })
    expect(window.location.search).toBe('?travel=travel-test&view=step&step=step-1')
    expect(readTravelLocation(window.location.search)).toEqual({
      travelId: 'travel-test',
      view: { kind: 'step', stepId: 'step-1' },
    })

    writeTravelLocation({ travelId: 'travel-test', view: { kind: 'day', dayId: 'day-1' } })
    expect(window.location.search).toBe('?travel=travel-test&view=day&day=day-1')
  })

  it('revient à l’aperçu pour une étape sans identifiant', () => {
    expect(readTravelLocation('?travel=travel-test&view=step')).toEqual({
      travelId: 'travel-test',
      view: { kind: 'summary' },
    })
  })

  it.each(['document', 'reservation'] as const)(
    'écrit puis relit la fiche d’une pièce de type %s',
    (pieceKind) => {
      writeTravelLocation({
        travelId: 'travel-test',
        view: { kind: 'piece', pieceKind, pieceId: 'piece-1' },
      })
      expect(window.location.search).toBe(`?travel=travel-test&view=piece&${pieceKind}=piece-1`)
      expect(readTravelLocation(window.location.search)).toEqual({
        travelId: 'travel-test',
        view: { kind: 'piece', pieceKind, pieceId: 'piece-1' },
      })

      writeTravelLocation({ travelId: 'travel-test', view: { kind: 'pieces' } })
      expect(window.location.search).toBe('?travel=travel-test&view=pieces')
    },
  )

  it('revient à l’aperçu pour une fiche sans pièce identifiée', () => {
    expect(readTravelLocation('?travel=travel-test&view=piece')).toEqual({
      travelId: 'travel-test',
      view: { kind: 'summary' },
    })
  })

  it('écrit puis relit l’espace Pièces pour préserver le retour d’un service externe', () => {
    writeTravelLocation({ travelId: 'travel-test', view: { kind: 'pieces' } })
    expect(window.location.search).toBe('?travel=travel-test&view=pieces')
    expect(readTravelLocation(window.location.search)).toEqual({
      travelId: 'travel-test',
      view: { kind: 'pieces' },
    })
  })
})
