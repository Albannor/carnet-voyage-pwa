export type EntityId = string
export type IsoDate = string
export type LocalTime = string
export type LanguageTag = string
export type IanaTimeZone = string

export type TravelVariantKind = 'standard' | 'low-walking' | 'rain'

export interface TravelPeriod {
  start: IsoDate
  end: IsoDate
}

export interface TravelDestination {
  label: string
  countryCode: string
}

export interface TravelLink {
  id: EntityId
  label: string
  href: string
}

export interface TravelPlace {
  id: EntityId
  label: string
  address?: string
  links: readonly TravelLink[]
}

export interface TravelAccommodation {
  id: EntityId
  label: string
  placeId: EntityId
  period: TravelPeriod
}

export interface TravelStep {
  id: EntityId
  title: string
  description?: string
  startsAt?: LocalTime
  endsAt?: LocalTime
  placeId?: EntityId
  accommodationId?: EntityId
  links: readonly TravelLink[]
}

export interface TravelDay {
  id: EntityId
  date: IsoDate
  title: string
  summary?: string
  steps: readonly TravelStep[]
}

export type TravelVariantTarget =
  | {
      type: 'day'
      dayId: EntityId
    }
  | {
      type: 'step'
      stepId: EntityId
    }

export interface TravelVariant {
  id: EntityId
  kind: TravelVariantKind
  label: string
  description: string
  target: TravelVariantTarget
}

export interface Travel {
  id: EntityId
  contentVersion: string
  title: string
  destination: TravelDestination
  locale: LanguageTag
  timeZone: IanaTimeZone
  period: TravelPeriod
  summary: string
  accommodations: readonly TravelAccommodation[]
  places: readonly TravelPlace[]
  days: readonly TravelDay[]
  variants: readonly TravelVariant[]
}
