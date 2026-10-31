import { describe, expect, it, vi } from 'vitest'
import { requestScreenWakeLock, type ScreenWakeLockHandle } from './screenWakeLock'

describe('verrou d’écran', () => {
  it('renvoie undefined sans erreur lorsque l’API est absente', async () => {
    await expect(requestScreenWakeLock({})).resolves.toBeUndefined()
    await expect(requestScreenWakeLock(undefined)).resolves.toBeUndefined()
  })

  it('renvoie undefined lorsque le navigateur refuse le verrou', async () => {
    const request = vi.fn().mockRejectedValue(new DOMException('refusé', 'NotAllowedError'))

    await expect(requestScreenWakeLock({ wakeLock: { request } })).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('renvoie le verrou obtenu', async () => {
    const handle: ScreenWakeLockHandle = {
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    }

    await expect(requestScreenWakeLock({
      wakeLock: { request: vi.fn().mockResolvedValue(handle) },
    })).resolves.toBe(handle)
  })
})
