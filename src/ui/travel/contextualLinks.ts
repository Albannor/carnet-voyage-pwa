import type { TravelLink } from '../../domain/voyage/model'
import { safeExternalHttpsUrl } from '../../services/travelActions'

function linkIdentity(link: TravelLink) {
  return safeExternalHttpsUrl(link.href) ?? `invalid:${link.href}`
}

export function uniqueContextualLinks(
  stepLinks: readonly TravelLink[],
  placeLinks: readonly TravelLink[] = [],
) {
  const seen = new Set<string>()
  return [...stepLinks, ...placeLinks].filter((link) => {
    const identity = linkIdentity(link)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function stepIllustrationLink(
  stepLinks: readonly TravelLink[],
  placeLinks: readonly TravelLink[] = [],
) {
  const validStepLinks = uniqueContextualLinks(stepLinks)
    .filter((link) => safeExternalHttpsUrl(link.href))
  if (validStepLinks.length === 1) return validStepLinks[0]

  if (stepLinks.length !== 0) return undefined
  const validPlaceLinks = uniqueContextualLinks(placeLinks)
    .filter((link) => safeExternalHttpsUrl(link.href))
  return validPlaceLinks.length === 1 ? validPlaceLinks[0] : undefined
}

export function linksNotCarriedByIllustration(
  links: readonly TravelLink[],
  illustrationLink?: TravelLink,
) {
  if (!illustrationLink) return links
  const carriedIdentity = linkIdentity(illustrationLink)
  return links.filter((link) => linkIdentity(link) !== carriedIdentity)
}
