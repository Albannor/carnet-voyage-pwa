import type { TravelView } from './TravelConsultation'

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
  if (view === 'today') return { travelId, view: { kind: 'today' } }
  if (view === 'day' && dayId) {
    return { travelId, view: { kind: 'day', dayId } }
  }
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

  if (location) {
    url.searchParams.set('travel', location.travelId)
    url.searchParams.set('view', location.view.kind)
    if (location.view.kind === 'day') {
      url.searchParams.set('day', location.view.dayId)
    }
  }

  window.history[mode === 'push' ? 'pushState' : 'replaceState'](
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}
