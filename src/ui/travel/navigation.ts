import type { TravelView } from './TravelConsultation'

const PIECE_KINDS = ['document', 'reservation', 'added'] as const

export interface TravelLocation {
  readonly travelId: string
  readonly view: TravelView
}

export function readTravelLocation(search: string): TravelLocation | undefined {
  const parameters = new URLSearchParams(search)
  const travelId = parameters.get('travel')?.trim()
  if (!travelId) return undefined

  const view = parameters.get('view')
  const dayId = parameters.get('day')?.trim()
  const stepId = parameters.get('step')?.trim()
  if (view === 'today') return { travelId, view: { kind: 'today' } }
  if (view === 'day' && dayId) {
    return { travelId, view: { kind: 'day', dayId } }
  }
  if (view === 'step' && stepId) {
    return { travelId, view: { kind: 'step', stepId } }
  }
  if (view === 'piece') {
    for (const pieceKind of PIECE_KINDS) {
      const pieceId = parameters.get(pieceKind)?.trim()
      if (pieceId) return { travelId, view: { kind: 'piece', pieceKind, pieceId } }
    }
  }
  if (view === 'add-piece') {
    if (stepId) return { travelId, view: { kind: 'add-piece', attachment: { type: 'step', stepId } } }
    if (dayId) return { travelId, view: { kind: 'add-piece', attachment: { type: 'day', dayId } } }
    return { travelId, view: { kind: 'add-piece' } }
  }
  if (view === 'pieces') return { travelId, view: { kind: 'pieces' } }
  if (view === 'practical') return { travelId, view: { kind: 'practical' } }
  if (view === 'preparation') return { travelId, view: { kind: 'preparation' } }
  return { travelId, view: { kind: 'summary' } }
}

export function writeTravelLocation(
  location: TravelLocation | undefined,
  mode: 'push' | 'replace' = 'push',
) {
  const url = new URL(window.location.href)
  url.searchParams.delete('travel')
  url.searchParams.delete('view')
  url.searchParams.delete('day')
  url.searchParams.delete('step')
  url.searchParams.delete('document')
  url.searchParams.delete('reservation')
  url.searchParams.delete('added')

  if (location) {
    url.searchParams.set('travel', location.travelId)
    url.searchParams.set('view', location.view.kind)
    if (location.view.kind === 'day') {
      url.searchParams.set('day', location.view.dayId)
    }
    if (location.view.kind === 'step') {
      url.searchParams.set('step', location.view.stepId)
    }
    if (location.view.kind === 'piece') {
      url.searchParams.set(location.view.pieceKind, location.view.pieceId)
    }
    if (location.view.kind === 'add-piece') {
      const { attachment } = location.view
      if (attachment?.type === 'day') url.searchParams.set('day', attachment.dayId)
      if (attachment?.type === 'step') url.searchParams.set('step', attachment.stepId)
    }
  }

  window.history[mode === 'push' ? 'pushState' : 'replaceState'](
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}
