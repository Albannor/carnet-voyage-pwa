export const TRAVEL_CONTENT_MODEL_VERSION = '1.0.0' as const

export type TravelContentModelVersion = typeof TRAVEL_CONTENT_MODEL_VERSION

export interface ExternalLinkDocument {
  id: string
  label: string
  url: string
}

export interface DestinationDocument {
  name: string
  countryCode: string
}

export interface PlaceDocument {
  id: string
  name: string
  address?: string
  links: ExternalLinkDocument[]
}

export interface AccommodationDocument {
  id: string
  name: string
  placeId: string
  startDate: string
  endDate: string
}

export interface StepDocument {
  id: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  placeId?: string
  accommodationId?: string
  links: ExternalLinkDocument[]
}

export interface DayDocument {
  id: string
  date: string
  title: string
  summary?: string
  steps: StepDocument[]
}

export type VariantKindDocument = 'standard' | 'low-walking' | 'rain'
export type VariantTargetTypeDocument = 'day' | 'step'

export interface VariantDocument {
  id: string
  kind: VariantKindDocument
  label: string
  description: string
  targetType: VariantTargetTypeDocument
  targetId: string
}

export interface TravelDocumentV1 {
  contentModelVersion: TravelContentModelVersion
  id: string
  title: string
  destination: DestinationDocument
  language: string
  timeZone: string
  startDate: string
  endDate: string
  summary: string
  accommodations: AccommodationDocument[]
  places: PlaceDocument[]
  days: DayDocument[]
  variants: VariantDocument[]
}
