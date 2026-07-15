import type {
  EntityId,
  Travel,
  TravelLink,
  TravelStep,
} from './model'
import { CHECKLIST_LIMITS } from './checklistLimits'

export type DomainIssueCode =
  | 'ACCOMMODATION_DATE_RANGE'
  | 'CHECKLIST_LIMIT_EXCEEDED'
  | 'CHECKLIST_TEXT_INVALID'
  | 'DAY_ORDER'
  | 'DAY_OUTSIDE_TRAVEL'
  | 'DUPLICATE_ID'
  | 'INVALID_TIME_ZONE'
  | 'STEP_END_WITHOUT_START'
  | 'STEP_ORDER'
  | 'STEP_TIME_RANGE'
  | 'TRAVEL_DATE_RANGE'
  | 'UNKNOWN_ACCOMMODATION_REFERENCE'
  | 'UNKNOWN_CHECKLIST_TARGET'
  | 'UNKNOWN_DOCUMENT_REFERENCE'
  | 'UNKNOWN_PLACE_REFERENCE'
  | 'UNKNOWN_RESERVATION_REFERENCE'
  | 'UNKNOWN_VARIANT_TARGET'
  | 'UNSUPPORTED_URL_PROTOCOL'

export interface DomainValidationIssue {
  source: 'domain'
  code: DomainIssueCode
  path: string
  message: string
}

interface IdentifiedItem {
  id: EntityId
  path: string
}

interface LinkedItem {
  link: TravelLink
  path: string
}

function issue(
  code: DomainIssueCode,
  path: string,
  message: string,
): DomainValidationIssue {
  return { source: 'domain', code, path, message }
}

function duplicateIdIssues(items: readonly IdentifiedItem[]) {
  const seen = new Set<EntityId>()

  return items.flatMap(({ id, path }) => {
    if (seen.has(id)) {
      return [
        issue(
          'DUPLICATE_ID',
          path,
          `L'identifiant « ${id} » est déjà utilisé dans ce périmètre.`,
        ),
      ]
    }

    seen.add(id)
    return []
  })
}

function entityItems<T extends { id: EntityId }>(
  entities: readonly T[],
  basePath: string,
): IdentifiedItem[] {
  return entities.map((entity, index) => ({
    id: entity.id,
    path: `${basePath}/${index}/id`,
  }))
}

function timeZoneIsSupported(timeZone: string) {
  try {
    new Intl.DateTimeFormat('fr', { timeZone }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

function stepTimeIssues(step: TravelStep, path: string) {
  const issues: DomainValidationIssue[] = []

  if (step.endsAt && !step.startsAt) {
    issues.push(
      issue(
        'STEP_END_WITHOUT_START',
        `${path}/endTime`,
        'Une heure de fin nécessite une heure de début.',
      ),
    )
  }

  if (step.startsAt && step.endsAt && step.endsAt < step.startsAt) {
    issues.push(
      issue(
        'STEP_TIME_RANGE',
        `${path}/endTime`,
        "L'heure de fin ne peut pas précéder l'heure de début.",
      ),
    )
  }

  return issues
}

function linkIssues(linkedItems: readonly LinkedItem[]) {
  return linkedItems.flatMap(({ link, path }) => {
    try {
      const url = new URL(link.href)

      return url.protocol === 'https:'
        ? []
        : [
            issue(
              'UNSUPPORTED_URL_PROTOCOL',
              `${path}/url`,
              `Le protocole « ${url.protocol} » n'est pas autorisé ; seul HTTPS est accepté.`,
            ),
          ]
    } catch {
      return [
        issue(
          'UNSUPPORTED_URL_PROTOCOL',
          `${path}/url`,
          "L'URL externe n'est pas une URL HTTPS valide.",
        ),
      ]
    }
  })
}

export function validateTravel(travel: Travel): DomainValidationIssue[] {
  const issues: DomainValidationIssue[] = []
  const placeIds = new Set(travel.places.map((place) => place.id))
  const accommodationIds = new Set(
    travel.accommodations.map((accommodation) => accommodation.id),
  )
  const dayIds = new Set(travel.days.map((day) => day.id))
  const stepIds = new Set(travel.days.flatMap((day) => day.steps.map((step) => step.id)))
  const documentIds = new Set(travel.documents.map((document) => document.id))
  const reservationIds = new Set(
    travel.reservations.map((reservation) => reservation.id),
  )

  issues.push(
    ...duplicateIdIssues(entityItems(travel.places, '/places')),
    ...duplicateIdIssues(entityItems(travel.accommodations, '/accommodations')),
    ...duplicateIdIssues(entityItems(travel.days, '/days')),
    ...duplicateIdIssues(entityItems(travel.variants, '/variants')),
    ...duplicateIdIssues(entityItems(travel.documents, '/documents')),
    ...duplicateIdIssues(entityItems(travel.reservations, '/reservations')),
    ...duplicateIdIssues(entityItems(travel.checklists, '/checklists')),
  )

  if (travel.checklists.length > CHECKLIST_LIMITS.maxChecklists) {
    issues.push(issue(
      'CHECKLIST_LIMIT_EXCEEDED',
      '/checklists',
      `Un voyage ne peut pas contenir plus de ${CHECKLIST_LIMITS.maxChecklists} checklists.`,
    ))
  }

  travel.checklists.forEach((checklist, checklistIndex) => {
    const checklistPath = `/checklists/${checklistIndex}`
    issues.push(...duplicateIdIssues(entityItems(checklist.items, `${checklistPath}/items`)))

    if (checklist.items.length === 0 || checklist.items.length > CHECKLIST_LIMITS.maxItemsPerChecklist) {
      issues.push(issue(
        'CHECKLIST_LIMIT_EXCEEDED',
        `${checklistPath}/items`,
        `Une checklist doit contenir entre 1 et ${CHECKLIST_LIMITS.maxItemsPerChecklist} éléments.`,
      ))
    }

    const texts = [
      { value: checklist.title, path: `${checklistPath}/title`, max: CHECKLIST_LIMITS.maxTitleLength },
      ...(checklist.description === undefined ? [] : [{ value: checklist.description, path: `${checklistPath}/description`, max: CHECKLIST_LIMITS.maxDescriptionLength }]),
      ...checklist.items.flatMap((item, itemIndex) => [
        { value: item.label, path: `${checklistPath}/items/${itemIndex}/label`, max: CHECKLIST_LIMITS.maxTitleLength },
        ...(item.description === undefined ? [] : [{ value: item.description, path: `${checklistPath}/items/${itemIndex}/description`, max: CHECKLIST_LIMITS.maxDescriptionLength }]),
      ]),
    ]
    texts.forEach(({ value, path, max }) => {
      if (value.length === 0 || value.length > max) {
        issues.push(issue(
          'CHECKLIST_TEXT_INVALID',
          path,
          `Ce texte doit contenir entre 1 et ${max} caractères.`,
        ))
      }
    })

    const targetExists = checklist.target.type === 'travel'
      ? true
      : checklist.target.type === 'day'
        ? dayIds.has(checklist.target.dayId)
        : stepIds.has(checklist.target.stepId)
    if (!targetExists) {
      const targetPath = checklist.target.type === 'day' ? 'dayId' : 'stepId'
      issues.push(issue(
        'UNKNOWN_CHECKLIST_TARGET',
        `${checklistPath}/target/${targetPath}`,
        'La cible de cette checklist n’existe pas dans le voyage.',
      ))
    }
  })

  const stepItems = travel.days.flatMap((day, dayIndex) =>
    day.steps.map((step, stepIndex) => ({
      id: step.id,
      path: `/days/${dayIndex}/steps/${stepIndex}/id`,
    })),
  )
  issues.push(...duplicateIdIssues(stepItems))

  const linkedItems: LinkedItem[] = []
  travel.places.forEach((place, placeIndex) => {
    place.links.forEach((link, linkIndex) => {
      linkedItems.push({ link, path: `/places/${placeIndex}/links/${linkIndex}` })
    })
  })
  travel.days.forEach((day, dayIndex) => {
    day.steps.forEach((step, stepIndex) => {
      step.links.forEach((link, linkIndex) => {
        linkedItems.push({
          link,
          path: `/days/${dayIndex}/steps/${stepIndex}/links/${linkIndex}`,
        })
      })
    })
  })
  travel.reservations.forEach((reservation, reservationIndex) => {
    reservation.links.forEach((link, linkIndex) => {
      linkedItems.push({
        link,
        path: `/reservations/${reservationIndex}/links/${linkIndex}`,
      })
    })
  })
  issues.push(
    ...duplicateIdIssues(
      linkedItems.map(({ link, path }) => ({ id: link.id, path: `${path}/id` })),
    ),
    ...linkIssues(linkedItems),
  )

  if (travel.period.end < travel.period.start) {
    issues.push(
      issue(
        'TRAVEL_DATE_RANGE',
        '/endDate',
        'La date de fin du voyage ne peut pas précéder sa date de début.',
      ),
    )
  }

  if (!timeZoneIsSupported(travel.timeZone)) {
    issues.push(
      issue(
        'INVALID_TIME_ZONE',
        '/timeZone',
        `Le fuseau horaire « ${travel.timeZone} » n'est pas reconnu par la plateforme.`,
      ),
    )
  }

  travel.accommodations.forEach((accommodation, index) => {
    if (accommodation.period.end < accommodation.period.start) {
      issues.push(
        issue(
          'ACCOMMODATION_DATE_RANGE',
          `/accommodations/${index}/endDate`,
          "La date de fin de l'hébergement ne peut pas précéder sa date de début.",
        ),
      )
    }

    if (!placeIds.has(accommodation.placeId)) {
      issues.push(
        issue(
          'UNKNOWN_PLACE_REFERENCE',
          `/accommodations/${index}/placeId`,
          `Le lieu « ${accommodation.placeId} » référencé par l'hébergement n'existe pas.`,
        ),
      )
    }
  })

  let previousDayDate: string | undefined
  travel.days.forEach((day, dayIndex) => {
    const dayPath = `/days/${dayIndex}`

    day.documentIds.forEach((documentId, referenceIndex) => {
      if (!documentIds.has(documentId)) {
        issues.push(
          issue(
            'UNKNOWN_DOCUMENT_REFERENCE',
            `${dayPath}/documentIds/${referenceIndex}`,
            `Le document « ${documentId} » référencé par la journée n'existe pas.`,
          ),
        )
      }
    })
    day.reservationIds.forEach((reservationId, referenceIndex) => {
      if (!reservationIds.has(reservationId)) {
        issues.push(
          issue(
            'UNKNOWN_RESERVATION_REFERENCE',
            `${dayPath}/reservationIds/${referenceIndex}`,
            `La réservation « ${reservationId} » référencée par la journée n'existe pas.`,
          ),
        )
      }
    })

    if (day.date < travel.period.start || day.date > travel.period.end) {
      issues.push(
        issue(
          'DAY_OUTSIDE_TRAVEL',
          `${dayPath}/date`,
          `La journée du ${day.date} est en dehors de la période du voyage.`,
        ),
      )
    }

    if (previousDayDate && day.date <= previousDayDate) {
      issues.push(
        issue(
          'DAY_ORDER',
          `${dayPath}/date`,
          'Les journées doivent être classées par dates strictement croissantes.',
        ),
      )
    }
    previousDayDate = day.date

    let previousStepTime: string | undefined
    day.steps.forEach((step, stepIndex) => {
      const stepPath = `${dayPath}/steps/${stepIndex}`
      issues.push(...stepTimeIssues(step, stepPath))

      if (step.startsAt) {
        if (previousStepTime && step.startsAt < previousStepTime) {
          issues.push(
            issue(
              'STEP_ORDER',
              `${stepPath}/startTime`,
              'Les étapes horaires doivent être classées chronologiquement.',
            ),
          )
        }
        previousStepTime = step.startsAt
      }

      if (step.placeId && !placeIds.has(step.placeId)) {
        issues.push(
          issue(
            'UNKNOWN_PLACE_REFERENCE',
            `${stepPath}/placeId`,
            `Le lieu « ${step.placeId} » référencé par l'étape n'existe pas.`,
          ),
        )
      }

      if (
        step.accommodationId &&
        !accommodationIds.has(step.accommodationId)
      ) {
        issues.push(
          issue(
            'UNKNOWN_ACCOMMODATION_REFERENCE',
            `${stepPath}/accommodationId`,
            `L'hébergement « ${step.accommodationId} » référencé par l'étape n'existe pas.`,
          ),
        )
      }

      step.documentIds.forEach((documentId, referenceIndex) => {
        if (!documentIds.has(documentId)) {
          issues.push(
            issue(
              'UNKNOWN_DOCUMENT_REFERENCE',
              `${stepPath}/documentIds/${referenceIndex}`,
              `Le document « ${documentId} » référencé par l'étape n'existe pas.`,
            ),
          )
        }
      })
      step.reservationIds.forEach((reservationId, referenceIndex) => {
        if (!reservationIds.has(reservationId)) {
          issues.push(
            issue(
              'UNKNOWN_RESERVATION_REFERENCE',
              `${stepPath}/reservationIds/${referenceIndex}`,
              `La réservation « ${reservationId} » référencée par l'étape n'existe pas.`,
            ),
          )
        }
      })
    })
  })

  travel.reservations.forEach((reservation, reservationIndex) => {
    reservation.documentIds.forEach((documentId, referenceIndex) => {
      if (!documentIds.has(documentId)) {
        issues.push(
          issue(
            'UNKNOWN_DOCUMENT_REFERENCE',
            `/reservations/${reservationIndex}/documentIds/${referenceIndex}`,
            `Le document « ${documentId} » référencé par la réservation n'existe pas.`,
          ),
        )
      }
    })
  })

  travel.variants.forEach((variant, index) => {
    const targetExists =
      variant.target.type === 'day'
        ? dayIds.has(variant.target.dayId)
        : stepIds.has(variant.target.stepId)

    if (!targetExists) {
      const targetId =
        variant.target.type === 'day'
          ? variant.target.dayId
          : variant.target.stepId
      issues.push(
        issue(
          'UNKNOWN_VARIANT_TARGET',
          `/variants/${index}/targetId`,
          `La cible « ${targetId} » de la variante n'existe pas.`,
        ),
      )
    }
  })

  return issues
}
