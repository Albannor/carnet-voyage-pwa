/** Fichier local relu depuis IndexedDB : ressource importée ou pièce ajoutée. */
export interface LocalFile {
  readonly mediaType: string
  readonly bytes: Uint8Array
}

export interface TravelPlatformActions {
  copyText(value: string): Promise<boolean>
  openLocalPdf(file: LocalFile, label: string): boolean
}

export function safeExternalHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export const browserTravelPlatformActions: TravelPlatformActions = {
  async copyText(value) {
    if (!navigator.clipboard?.writeText) return false
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      return false
    }
  },
  openLocalPdf(resource, label) {
    if (resource.mediaType !== 'application/pdf') return false
    let url: string | undefined
    try {
      const blob = new Blob([Uint8Array.from(resource.bytes).buffer], {
        type: 'application/pdf',
      })
      url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.setAttribute('aria-label', `Ouvrir ${label}`)
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url!), 60_000)
      return true
    } catch {
      if (url) URL.revokeObjectURL(url)
      return false
    }
  },
}
