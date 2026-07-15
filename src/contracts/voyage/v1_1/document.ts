import type {
  AccommodationDocument,
  DestinationDocument,
  ExternalLinkDocument,
  VariantDocument,
} from '../v1/document'

export const TRAVEL_CONTENT_MODEL_VERSION_1_1 = '1.1.0' as const

export interface TravelResourceDocumentV1_1 {
  id: string
  label: string
  description?: string
  resourceId: string
}

export interface ReservationDocumentV1_1 {
  id: string
  label: string
  reference?: string
  date?: string
  time?: string
  status?: string
  links?: ExternalLinkDocument[]
  documentIds?: string[]
}

export interface StepDocumentV1_1 {
  id: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  placeId?: string
  accommodationId?: string
  links: ExternalLinkDocument[]
  documentIds?: string[]
  reservationIds?: string[]
}

export interface DayDocumentV1_1 {
  id: string
  date: string
  title: string
  summary?: string
  steps: StepDocumentV1_1[]
  documentIds?: string[]
  reservationIds?: string[]
}

export interface TravelDocumentV1_1 {
  contentModelVersion: typeof TRAVEL_CONTENT_MODEL_VERSION_1_1
  id: string
  title: string
  destination: DestinationDocument
  language: string
  timeZone: string
  startDate: string
  endDate: string
  summary: string
  accommodations: AccommodationDocument[]
  places: Array<{
    id: string
    name: string
    address?: string
    links: ExternalLinkDocument[]
  }>
  days: DayDocumentV1_1[]
  variants: VariantDocument[]
  documents?: TravelResourceDocumentV1_1[]
  reservations?: ReservationDocumentV1_1[]
}
