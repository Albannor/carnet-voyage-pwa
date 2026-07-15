import { describe, expect, it } from 'vitest'
import dangerousUrl from '../../../examples/voyage/1.0.0/invalid/dangerous-url.json'
import dayOrder from '../../../examples/voyage/1.0.0/invalid/day-order.json'
import dayOutsidePeriod from '../../../examples/voyage/1.0.0/invalid/day-outside-period.json'
import duplicateId from '../../../examples/voyage/1.0.0/invalid/duplicate-id.json'
import incoherentTripDates from '../../../examples/voyage/1.0.0/invalid/incoherent-trip-dates.json'
import invalidTimeZone from '../../../examples/voyage/1.0.0/invalid/invalid-time-zone.json'
import missingReferences from '../../../examples/voyage/1.0.0/invalid/missing-references.json'
import missingVariantTarget from '../../../examples/voyage/1.0.0/invalid/missing-variant-target.json'
import unorderedSteps from '../../../examples/voyage/1.0.0/invalid/unordered-steps.json'
import validTravel from '../../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import { validateTravelDocumentSchema } from '../../contracts/voyage/v1/schemaValidation'
import { toTravel } from '../../contracts/voyage/v1/toTravel'
import { validateTravel } from './validation'
import validTravelV1_2 from '../../../examples/voyage/1.2.0/valid/coastal-checklists.json'
import invalidChecklistCases from '../../../examples/voyage/1.2.0/invalid/checklist-cases.json'
import { validateTravelDocumentSchemaV1_2 } from '../../contracts/voyage/v1_2/schemaValidation'
import { toTravelV1_2 } from '../../contracts/voyage/v1_2/toTravel'

function domainIssuesFor(input: unknown) {
  const contractResult = validateTravelDocumentSchema(input)

  expect(contractResult.valid).toBe(true)
  if (!contractResult.valid) {
    throw new Error(JSON.stringify(contractResult.issues))
  }

  return validateTravel(toTravel(contractResult.document))
}

function expectDomainIssue(
  input: unknown,
  expected: { code: string; path: string },
) {
  expect(domainIssuesFor(input)).toContainEqual(expect.objectContaining(expected))
}

describe('invariants du modèle métier', () => {
  it('accepte le voyage valide sans erreur sémantique', () => {
    expect(domainIssuesFor(validTravel)).toEqual([])
  })

  it('détecte un identifiant dupliqué dans son périmètre', () => {
    expectDomainIssue(duplicateId, {
      code: 'DUPLICATE_ID',
      path: '/places/1/id',
    })
  })

  it('détecte une période de voyage inversée', () => {
    expectDomainIssue(incoherentTripDates, {
      code: 'TRAVEL_DATE_RANGE',
      path: '/endDate',
    })
  })

  it('détecte une journée hors de la période du voyage', () => {
    expectDomainIssue(dayOutsidePeriod, {
      code: 'DAY_OUTSIDE_TRAVEL',
      path: '/days/0/date',
    })
  })

  it('détecte des journées non chronologiques', () => {
    expectDomainIssue(dayOrder, {
      code: 'DAY_ORDER',
      path: '/days/1/date',
    })
  })

  it('détecte des étapes horaires non chronologiques', () => {
    expectDomainIssue(unorderedSteps, {
      code: 'STEP_ORDER',
      path: '/days/0/steps/1/startTime',
    })
  })

  it('identifie chaque référence absente avec son chemin', () => {
    const issues = domainIssuesFor(missingReferences)

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_PLACE_REFERENCE',
        path: '/accommodations/0/placeId',
      }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_PLACE_REFERENCE',
        path: '/days/0/steps/0/placeId',
      }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_ACCOMMODATION_REFERENCE',
        path: '/days/0/steps/0/accommodationId',
      }),
    )
  })

  it('détecte la cible inexistante d’une variante', () => {
    expectDomainIssue(missingVariantTarget, {
      code: 'UNKNOWN_VARIANT_TARGET',
      path: '/variants/0/targetId',
    })
  })

  it('accepte les URL HTTPS et refuse les protocoles actifs', () => {
    expect(domainIssuesFor(validTravel)).not.toContainEqual(
      expect.objectContaining({ code: 'UNSUPPORTED_URL_PROTOCOL' }),
    )
    expectDomainIssue(dangerousUrl, {
      code: 'UNSUPPORTED_URL_PROTOCOL',
      path: '/places/0/links/0/url',
    })
  })

  it('vérifie l’existence du fuseau IANA au-delà de sa forme', () => {
    expectDomainIssue(invalidTimeZone, {
      code: 'INVALID_TIME_ZONE',
      path: '/timeZone',
    })
  })
})

describe('invariants des checklists', () => {
  function travelV1_2() {
    const result = validateTravelDocumentSchemaV1_2(structuredClone(validTravelV1_2))
    if (!result.valid) throw new Error(JSON.stringify(result.issues))
    return toTravelV1_2(result.document)
  }

  it('accepte les checklists valides et conserve leur ordre', () => {
    const travel = travelV1_2()
    expect(validateTravel(travel)).toEqual([])
    expect(travel.checklists[0]?.items.map((item) => item.id)).toEqual([
      'item-identification', 'item-charger',
    ])
  })

  it('refuse les identifiants de checklist et d’élément dupliqués', () => {
    const travel = travelV1_2()
    const duplicateChecklist = {
      ...travel.checklists[0]!,
      id: invalidChecklistCases.duplicateChecklistId[1]!,
      items: [
        {
          ...travel.checklists[0]!.items[0]!,
          id: invalidChecklistCases.duplicateItemId[0]!,
        },
        {
          ...travel.checklists[0]!.items[1]!,
          id: invalidChecklistCases.duplicateItemId[1]!,
        },
      ],
    }
    const firstChecklist = {
      ...travel.checklists[0]!,
      id: invalidChecklistCases.duplicateChecklistId[0]!,
      items: [{
        ...travel.checklists[0]!.items[0]!,
        id: invalidChecklistCases.duplicateItemId[0]!,
      }],
    }
    const invalid = { ...travel, checklists: [firstChecklist, duplicateChecklist] }
    expect(validateTravel(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DUPLICATE_ID', path: '/checklists/1/id' }),
      expect.objectContaining({ code: 'DUPLICATE_ID', path: '/checklists/1/items/1/id' }),
    ]))
  })

  it('refuse les cibles de journée et d’étape inconnues', () => {
    const travel = travelV1_2()
    const invalid = {
      ...travel,
      checklists: [
        {
          ...travel.checklists[1]!,
          target: {
            type: 'day' as const,
            dayId: invalidChecklistCases.unknownDayTarget.dayId,
          },
        },
        {
          ...travel.checklists[2]!,
          target: {
            type: 'step' as const,
            stepId: invalidChecklistCases.unknownStepTarget.stepId,
          },
        },
      ],
    }
    expect(validateTravel(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_CHECKLIST_TARGET', path: '/checklists/0/target/dayId' }),
      expect.objectContaining({ code: 'UNKNOWN_CHECKLIST_TARGET', path: '/checklists/1/target/stepId' }),
    ]))
  })
})
