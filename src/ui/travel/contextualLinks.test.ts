import { describe, expect, it } from 'vitest'
import type { TravelLink } from '../../domain/voyage/model'
import {
  linksNotCarriedByIllustration,
  stepIllustrationLink,
  uniqueContextualLinks,
} from './contextualLinks'

function link(id: string, href: string): TravelLink {
  return { id, label: `Lien ${id}`, href }
}

describe('liens contextuels d’une étape', () => {
  it('réunit les liens de l’étape puis ceux du lieu en dédupliquant leur URL normalisée', () => {
    const stepLink = link('step', 'https://example.com/visit')
    const duplicatePlaceLink = link('place-duplicate', 'https://example.com/visit')
    const placeLink = link('place', 'https://example.com/route')

    expect(uniqueContextualLinks([stepLink], [duplicatePlaceLink, placeLink]))
      .toEqual([stepLink, placeLink])
  })

  it('porte sur l’image l’unique lien HTTPS explicite de l’étape en priorité', () => {
    const stepLink = link('step', 'https://example.com/official')
    const placeLink = link('place', 'https://example.com/route')

    expect(stepIllustrationLink([stepLink], [placeLink])).toBe(stepLink)
  })

  it('utilise l’unique lien HTTPS du lieu seulement si l’étape ne porte aucun lien', () => {
    const placeLink = link('place', 'https://example.com/route')

    expect(stepIllustrationLink([], [placeLink])).toBe(placeLink)
    expect(stepIllustrationLink(
      [link('unsafe', 'javascript:alert(1)')],
      [placeLink],
    )).toBeUndefined()
  })

  it('ne choisit aucun lien ambigu, non HTTPS ou issu de plusieurs possibilités', () => {
    expect(stepIllustrationLink([
      link('one', 'https://example.com/one'),
      link('two', 'https://example.com/two'),
    ])).toBeUndefined()
    expect(stepIllustrationLink([], [
      link('one', 'https://example.com/one'),
      link('two', 'https://example.com/two'),
    ])).toBeUndefined()
    expect(stepIllustrationLink([link('unsafe', 'http://example.com')]))
      .toBeUndefined()
  })

  it('retire de la liste compacte uniquement le lien déjà porté par l’image', () => {
    const imageLink = link('image', 'https://example.com/image-target')
    const secondary = link('secondary', 'https://example.com/secondary')

    expect(linksNotCarriedByIllustration([imageLink, secondary], imageLink))
      .toEqual([secondary])
  })
})
