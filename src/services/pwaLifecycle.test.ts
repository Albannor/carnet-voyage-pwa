import { describe, expect, it, vi } from 'vitest'
import {
  createPwaLifecycle,
  type ServiceWorkerRegistrationCallbacks,
} from './pwaLifecycle'

function registrationHarness() {
  let callbacks: ServiceWorkerRegistrationCallbacks = {}
  const update = vi.fn().mockResolvedValue(undefined)
  const register = vi.fn((nextCallbacks: ServiceWorkerRegistrationCallbacks) => {
    callbacks = nextCallbacks
    return update
  })

  return { register, update, callbacks: () => callbacks }
}

describe('cycle de vie PWA', () => {
  it.each([
    { production: false, serviceWorkerSupported: true },
    { production: true, serviceWorkerSupported: false },
  ])(
    'n’enregistre rien hors production ou sans API service worker (%o)',
    (environment) => {
      const lifecycle = createPwaLifecycle()
      const harness = registrationHarness()

      expect(lifecycle.start({ ...environment, register: harness.register })).toBe(
        false,
      )
      expect(harness.register).not.toHaveBeenCalled()
      expect(lifecycle.getState()).toEqual({ status: 'idle' })
    },
  )

  it('annonce que le shell est prêt hors ligne', () => {
    const lifecycle = createPwaLifecycle()
    const harness = registrationHarness()
    const listener = vi.fn()
    lifecycle.subscribe(listener)

    expect(
      lifecycle.start({
        production: true,
        serviceWorkerSupported: true,
        register: harness.register,
      }),
    ).toBe(true)
    harness.callbacks().onOfflineReady?.()

    expect(lifecycle.getState()).toEqual({ status: 'offline-ready' })
    expect(listener).toHaveBeenLastCalledWith({ status: 'offline-ready' })
  })

  it('attend une action explicite avant d’activer une mise à jour', async () => {
    const lifecycle = createPwaLifecycle()
    const harness = registrationHarness()
    lifecycle.start({
      production: true,
      serviceWorkerSupported: true,
      register: harness.register,
    })

    harness.callbacks().onNeedRefresh?.()
    expect(lifecycle.getState()).toEqual({ status: 'update-available' })
    expect(harness.update).not.toHaveBeenCalled()

    await lifecycle.applyUpdate()

    expect(harness.update).toHaveBeenCalledOnce()
    expect(harness.update).toHaveBeenCalledWith(true)
    expect(lifecycle.getState()).toEqual({ status: 'updating' })
  })

  it('ne touche pas à IndexedDB pendant l’installation ou la mise à jour du shell', async () => {
    const openDatabase = vi.spyOn(indexedDB, 'open')
    const lifecycle = createPwaLifecycle()
    const harness = registrationHarness()
    lifecycle.start({
      production: true,
      serviceWorkerSupported: true,
      register: harness.register,
    })

    harness.callbacks().onNeedRefresh?.()
    await lifecycle.applyUpdate()

    expect(openDatabase).not.toHaveBeenCalled()
    openDatabase.mockRestore()
  })

  it('présente une erreur générique si l’enregistrement ou la mise à jour échoue', async () => {
    const registrationFailure = createPwaLifecycle()
    registrationFailure.start({
      production: true,
      serviceWorkerSupported: true,
      register: () => {
        throw new Error('détail interne')
      },
    })
    expect(registrationFailure.getState()).toEqual({
      status: 'registration-error',
    })

    const updateFailure = createPwaLifecycle()
    let callbacks: ServiceWorkerRegistrationCallbacks = {}
    updateFailure.start({
      production: true,
      serviceWorkerSupported: true,
      register: (nextCallbacks) => {
        callbacks = nextCallbacks
        return vi.fn().mockRejectedValue(new Error('détail interne'))
      },
    })
    callbacks.onNeedRefresh?.()
    await updateFailure.applyUpdate()
    expect(updateFailure.getState()).toEqual({ status: 'registration-error' })
  })
})
