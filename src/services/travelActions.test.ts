import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistedTravelResource } from '../persistence/model'
import {
  browserTravelPlatformActions,
  safeExternalHttpsUrl,
} from './travelActions'

const pdfResource: PersistedTravelResource = {
  travelId: 'travel-test',
  resourceId: 'document-pdf',
  path: 'documents/document.pdf',
  mediaType: 'application/pdf',
  size: 5,
  sha256: 'a'.repeat(64),
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a]),
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubBlobUrls() {
  const NativeUrl = URL
  const createObjectURL = vi.fn(() => 'blob:http://localhost/document-pdf')
  const revokeObjectURL = vi.fn()
  class StubUrl extends NativeUrl {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  }
  vi.stubGlobal('URL', StubUrl)
  return { createObjectURL, revokeObjectURL }
}

describe('safeExternalHttpsUrl', () => {
  it('autorise uniquement une URL HTTPS absolue', () => {
    expect(safeExternalHttpsUrl('https://example.com/route?q=port')).toBe(
      'https://example.com/route?q=port',
    )
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.com',
    'file:///tmp/document',
    '/route/relative',
    'pas une url',
  ])('refuse le protocole ou format dangereux %s', (value) => {
    expect(safeExternalHttpsUrl(value)).toBeUndefined()
  })
})

describe('ouverture des PDF locaux', () => {
  it('ouvre le Blob sans téléchargement forcé puis libère son URL', () => {
    vi.useFakeTimers()
    const { createObjectURL, revokeObjectURL } = stubBlobUrls()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const opened = browserTravelPlatformActions.openLocalPdf(
      pdfResource,
      'Confirmation locale',
    )

    expect(opened).toBe(true)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.href).toBe('blob:http://localhost/document-pdf')
    expect(anchor.target).toBe('_blank')
    expect(anchor.rel).toBe('noopener noreferrer')
    expect(anchor).not.toHaveAttribute('download')
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60_000)
    expect(revokeObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(
      'blob:http://localhost/document-pdf',
    )
  })

  it('libère immédiatement le Blob si son ouverture échoue', () => {
    const { revokeObjectURL } = stubBlobUrls()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Ouverture refusée')
    })

    const opened = browserTravelPlatformActions.openLocalPdf(
      pdfResource,
      'Confirmation locale',
    )

    expect(opened).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('refuse une ressource locale qui n’est pas un PDF', () => {
    const { createObjectURL } = stubBlobUrls()

    const opened = browserTravelPlatformActions.openLocalPdf(
      { ...pdfResource, mediaType: 'image/png' },
      'Image',
    )

    expect(opened).toBe(false)
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
