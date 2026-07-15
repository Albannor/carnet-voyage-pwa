import type {
  Travel,
  TravelDay,
  TravelLink,
  TravelReservation,
  TravelStep,
  TravelVariant,
} from '../../../domain/voyage/model'
import type { ExternalLinkDocument, VariantDocument } from '../v1/document'
import type {
  DayDocumentV1_1,
  ReservationDocumentV1_1,
  StepDocumentV1_1,
  TravelDocumentV1_1,
} from './document'

function toLink(link: ExternalLinkDocument): TravelLink {
  return { id: link.id, label: link.label, href: link.url }
}

function toStep(step: StepDocumentV1_1): TravelStep {
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    startsAt: step.startTime,
    endsAt: step.endTime,
    placeId: step.placeId,
    accommodationId: step.accommodationId,
    links: step.links.map(toLink),
    documentIds: step.documentIds ?? [],
    reservationIds: step.reservationIds ?? [],
  }
}

function toDay(day: DayDocumentV1_1): TravelDay {
  return {
    id: day.id,
    date: day.date,
    title: day.title,
    summary: day.summary,
    steps: day.steps.map(toStep),
    documentIds: day.documentIds ?? [],
    reservationIds: day.reservationIds ?? [],
  }
}

function toVariant(variant: VariantDocument): TravelVariant {
  return {
    id: variant.id,
    kind: variant.kind,
    label: variant.label,
    description: variant.description,
    target:
      variant.targetType === 'day'
        ? { type: 'day', dayId: variant.targetId }
        : { type: 'step', stepId: variant.targetId },
  }
}

function toReservation(reservation: ReservationDocumentV1_1): TravelReservation {
  return {
    id: reservation.id,
    label: reservation.label,
    reference: reservation.reference,
    date: reservation.date,
    time: reservation.time,
    status: reservation.status,
    links: (reservation.links ?? []).map(toLink),
    documentIds: reservation.documentIds ?? [],
  }
}

export function toTravelV1_1(document: TravelDocumentV1_1): Travel {
  return {
    id: document.id,
    contentVersion: document.contentModelVersion,
    title: document.title,
    destination: {
      label: document.destination.name,
      countryCode: document.destination.countryCode,
    },
    locale: document.language,
    timeZone: document.timeZone,
    period: { start: document.startDate, end: document.endDate },
    summary: document.summary,
    accommodations: document.accommodations.map((accommodation) => ({
      id: accommodation.id,
      label: accommodation.name,
      placeId: accommodation.placeId,
      period: { start: accommodation.startDate, end: accommodation.endDate },
    })),
    places: document.places.map((place) => ({
      id: place.id,
      label: place.name,
      address: place.address,
      links: place.links.map(toLink),
    })),
    days: document.days.map(toDay),
    variants: document.variants.map(toVariant),
    documents: (document.documents ?? []).map((resourceDocument) => ({
      id: resourceDocument.id,
      label: resourceDocument.label,
      description: resourceDocument.description,
      resourceId: resourceDocument.resourceId,
    })),
    reservations: (document.reservations ?? []).map(toReservation),
  }
}
