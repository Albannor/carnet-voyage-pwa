import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persistentStorage'

describe('stockage persistant', () => {
  it('renvoie unsupported sans erreur lorsque l’API est absente', async () => {
    await expect(requestPersistentStorage({})).resolves.toBe('unsupported')
    await expect(requestPersistentStorage({ storage: {} })).resolves.toBe('unsupported')
    await expect(requestPersistentStorage(undefined)).resolves.toBe('unsupported')
  })

  it('ne redemande pas un stockage déjà persistant', async () => {
    const persist = vi.fn().mockResolvedValue(true)

    await expect(requestPersistentStorage({
      storage: { persisted: vi.fn().mockResolvedValue(true), persist },
    })).resolves.toBe('persisted')
    expect(persist).not.toHaveBeenCalled()
  })

  it('demande la persistance lorsqu’elle n’est pas encore accordée', async () => {
    const persist = vi.fn().mockResolvedValue(true)

    await expect(requestPersistentStorage({
      storage: { persisted: vi.fn().mockResolvedValue(false), persist },
    })).resolves.toBe('persisted')
    expect(persist).toHaveBeenCalledOnce()
  })

  it('renvoie best-effort lorsque le navigateur refuse ou échoue', async () => {
    await expect(requestPersistentStorage({
      storage: { persist: vi.fn().mockResolvedValue(false) },
    })).resolves.toBe('best-effort')
    await expect(requestPersistentStorage({
      storage: { persist: vi.fn().mockRejectedValue(new Error('refusé')) },
    })).resolves.toBe('best-effort')
  })
})
