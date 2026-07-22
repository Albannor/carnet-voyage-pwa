import { describe, expect, it, vi } from 'vitest'
import { createBrowserConnectivityAdapter } from './connectivity'

describe('adaptateur de connectivité du navigateur', () => {
  it('lit l’état initial puis suit les transitions online et offline', () => {
    const browserNavigator = { onLine: true }
    const listener = vi.fn()
    const adapter = createBrowserConnectivityAdapter(window, browserNavigator)

    expect(adapter.isOnline()).toBe(true)
    const unsubscribe = adapter.subscribe(listener)

    browserNavigator.onLine = false
    window.dispatchEvent(new Event('offline'))
    browserNavigator.onLine = true
    window.dispatchEvent(new Event('online'))

    expect(listener.mock.calls).toEqual([[false], [true]])

    unsubscribe()
    browserNavigator.onLine = false
    window.dispatchEvent(new Event('offline'))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
