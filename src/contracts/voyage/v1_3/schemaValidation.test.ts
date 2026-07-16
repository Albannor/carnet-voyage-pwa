import { describe, expect, it } from 'vitest'
import validTravel from '../../../../examples/voyage/1.3.0/valid/illustrated-coast.json'
import { validateTravelDocumentSchemaV1_3 } from './schemaValidation'

function clone() {
  return structuredClone(validTravel)
}

function expectInvalid(input: unknown, path: string) {
  const result = validateTravelDocumentSchemaV1_3(input)
  expect(result.valid).toBe(false)
  if (!result.valid) expect(result.issues.some((issue) => issue.path === path)).toBe(true)
}

describe('contrat voyage.json 1.3.0', () => {
  it('valide un voyage illustré complet', () => {
    const result = validateTravelDocumentSchemaV1_3(validTravel)
    expect(result.valid).toBe(true)
  })

  it('refuse les propriétés inconnues', () => {
    expectInvalid({ ...validTravel, unexpectedLayout: 'hero' }, '/unexpectedLayout')
  })

  it('refuse une provenance incomplète et une licence non autorisée', () => {
    const incomplete = clone()
    incomplete.illustrations[0]!.provenance = {
      type: 'licensed',
      creator: 'Auteur',
    } as never
    expectInvalid(incomplete, '/illustrations/0/provenance')

    const license = clone()
    license.illustrations[0]!.provenance.licenseCode = 'ALL-RIGHTS-RESERVED'
    expectInvalid(license, '/illustrations/0/provenance/licenseCode')
  })

  it('refuse une URL non HTTPS et un texte alternatif vide', () => {
    const url = clone()
    url.illustrations[0]!.provenance.sourceUrl = 'http://example.org/photo'
    expectInvalid(url, '/illustrations/0/provenance/sourceUrl')

    const alt = clone()
    alt.illustrations[0]!.alt = ''
    expectInvalid(alt, '/illustrations/0/alt')
  })

  it('applique les cardinalités des illustrations et références', () => {
    const illustrations = clone()
    illustrations.illustrations = Array.from(
      { length: 101 },
      (_, index) => ({
        ...illustrations.illustrations[1]!,
        id: `image-${index}`,
      }),
    )
    expectInvalid(illustrations, '/illustrations')

    const references = clone()
    references.days[0]!.illustrationIds = Array.from(
      { length: 101 },
      (_, index) => `image-${index}`,
    )
    expectInvalid(references, '/days/0/illustrationIds')
  })
})
