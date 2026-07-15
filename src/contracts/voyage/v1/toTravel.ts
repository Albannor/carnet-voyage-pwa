import type {
  DayDocument,
  ExternalLinkDocument,
  StepDocument,
  TravelDocumentV1,
  VariantDocument,
} from './document'
import type {
  Travel,
  TravelDay,
  TravelLink,
  TravelStep,
  TravelVariant,
} from '../../../domain/voyage/model'

function toLink(link: ExternalLinkDocument): TravelLink {
  return {
    id: link.id,
    label: link.label,
    href: link.url,
  }
}

function toStep(step: StepDocument): TravelStep {
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    startsAt: step.startTime,
    endsAt: step.endTime,
    placeId: step.placeId,
    accommodationId: step.accommodationId,
    links: step.links.map(toLink),
    documentIds: [],
    reservationIds: [],
  }
}

function toDay(day: DayDocument): TravelDay {
  return {
    id: day.id,
    date: day.date,
    title: day.title,
    summary: day.summary,
    steps: day.steps.map(toStep),
    documentIds: [],
    reservationIds: [],
  }
}

function toVariant(variant: VariantDocument): TravelVariant {
  const target =
    variant.targetType === 'day'
      ? { type: 'day' as const, dayId: variant.targetId }
      : { type: 'step' as const, stepId: variant.targetId }

  return {
    id: variant.id,
    kind: variant.kind,
    label: variant.label,
    description: variant.description,
    target,
  }
}

export function toTravel(document: TravelDocumentV1): Travel {
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
    period: {
      start: document.startDate,
      end: document.endDate,
    },
    summary: document.summary,
    accommodations: document.accommodations.map((accommodation) => ({
      id: accommodation.id,
      label: accommodation.name,
      placeId: accommodation.placeId,
      period: {
        start: accommodation.startDate,
        end: accommodation.endDate,
      },
    })),
    places: document.places.map((place) => ({
      id: place.id,
      label: place.name,
      address: place.address,
      links: place.links.map(toLink),
    })),
    days: document.days.map(toDay),
    variants: document.variants.map(toVariant),
    documents: [],
    reservations: [],
    checklists: [],
  }
}
