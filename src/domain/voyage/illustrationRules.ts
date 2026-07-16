export const ILLUSTRATION_LIMITS = Object.freeze({
  maxIllustrations: 100,
  maxReferencesPerContext: 100,
  maxAltLength: 300,
  maxCaptionLength: 500,
  maxCreditLength: 300,
  maxProviderLength: 200,
  maxCreatorLength: 300,
})

export const ALLOWED_ILLUSTRATION_LICENSES = [
  'PUBLIC-DOMAIN',
  'CC0-1.0',
  'CC-BY-2.0',
  'CC-BY-2.5',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC-BY-SA-2.0',
  'CC-BY-SA-2.5',
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
] as const

export function isAllowedIllustrationLicense(value: string) {
  return (ALLOWED_ILLUSTRATION_LICENSES as readonly string[]).includes(value)
}

export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
