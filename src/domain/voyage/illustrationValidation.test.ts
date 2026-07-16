import { describe, expect, it } from 'vitest'
import validTravelDocument from '../../../examples/voyage/1.3.0/valid/illustrated-coast.json'
import { toTravelV1_3 } from '../../contracts/voyage/v1_3/toTravel'
import type { TravelDocumentV1_3 } from '../../contracts/voyage/v1_3/document'
import { validateTravel } from './validation'

function validTravel() {
  return toTravelV1_3(
    structuredClone(validTravelDocument) as TravelDocumentV1_3,
  )
}

describe('invariants métier des illustrations', () => {
  it('accepte les références explicites valides', () => {
    expect(validateTravel(validTravel())).toEqual([])
  })

  it('refuse les identifiants dupliqués et la couverture inconnue', () => {
    const travel = validTravel()
    const issues = validateTravel({
      ...travel,
      coverIllustrationId: 'missing-cover',
      illustrations: [
        ...travel.illustrations,
        { ...travel.illustrations[0]!, resourceId: 'image-other' },
      ],
    })
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DUPLICATE_ID', path: '/illustrations/3/id' }),
      expect.objectContaining({ code: 'UNKNOWN_ILLUSTRATION_REFERENCE', path: '/coverIllustrationId' }),
    ]))
  })

  it('refuse les références inconnues depuis une journée et une étape', () => {
    const travel = validTravel()
    const issues = validateTravel({
      ...travel,
      days: [{
        ...travel.days[0]!,
        illustrationIds: ['missing-day'],
        steps: [{
          ...travel.days[0]!.steps[0]!,
          illustrationIds: ['missing-step'],
        }],
      }, ...travel.days.slice(1)],
    })
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'UNKNOWN_ILLUSTRATION_REFERENCE',
        path: '/days/0/illustrationIds/0',
      }),
      expect.objectContaining({
        code: 'UNKNOWN_ILLUSTRATION_REFERENCE',
        path: '/days/0/steps/0/illustrationIds/0',
      }),
    ]))
  })

  it('refuse défensivement une URL de provenance non HTTPS', () => {
    const travel = validTravel()
    const licensed = travel.illustrations[0]!
    if (licensed.provenance.type !== 'licensed') throw new Error('Fixture invalide')
    const issues = validateTravel({
      ...travel,
      illustrations: [{
        ...licensed,
        provenance: { ...licensed.provenance, sourceUrl: 'javascript:alert(1)' },
      }, ...travel.illustrations.slice(1)],
    })
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'ILLUSTRATION_PROVENANCE_URL_UNSUPPORTED',
      path: '/illustrations/0/provenance/sourceUrl',
    }))
  })
})
