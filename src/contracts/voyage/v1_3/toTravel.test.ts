import { describe, expect, it } from 'vitest'
import validV1 from '../../../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import validV1_1 from '../../../../examples/voyage/1.1.0/valid/coastal-trip.json'
import validV1_2 from '../../../../examples/voyage/1.2.0/valid/coastal-checklists.json'
import validV1_3 from '../../../../examples/voyage/1.3.0/valid/illustrated-coast.json'
import { validateTravelDocument } from '../../../application/validateTravelDocument'

describe('normalisation vers le modèle interne illustré', () => {
  it.each([
    ['1.0.0', validV1],
    ['1.1.0', validV1_1],
    ['1.2.0', validV1_2],
  ])('normalise %s avec des collections d’illustrations vides', (_, document) => {
    const result = validateTravelDocument(document)
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.travel.illustrations).toEqual([])
    expect(result.travel.days.every((day) =>
      day.illustrationIds.length === 0 &&
      day.steps.every((step) => step.illustrationIds.length === 0)
    )).toBe(true)
  })

  it('conserve les illustrations, associations et provenances de 1.3.0', () => {
    const result = validateTravelDocument(validV1_3)
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.travel.coverIllustrationId).toBe('cover-photo')
    expect(result.travel.days[0]?.illustrationIds).toEqual(['day-photo'])
    expect(result.travel.days[0]?.steps[0]?.illustrationIds).toEqual(['step-image'])
    expect(result.travel.illustrations.map((illustration) => illustration.provenance.type))
      .toEqual(['licensed', 'user-provided', 'ai-generated'])
  })
})
