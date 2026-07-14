import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValidatedTravelPackage } from '../import/importTravelPackage'
import type { TravelLibraryRepository } from '../persistence/repository'
import { importTravelPackageToLibrary } from './importTravelPackageToLibrary'

const { importTravelPackageMock } = vi.hoisted(() => ({
  importTravelPackageMock: vi.fn(),
}))

vi.mock('../import/importTravelPackage', () => ({
  importTravelPackage: importTravelPackageMock,
}))

const selectedFile = {
  name: 'test.zip',
  type: 'application/zip',
  size: 3,
  async arrayBuffer() {
    return new ArrayBuffer(3)
  },
}

const validatedPackage = {
  manifest: { id: 'travel-test' },
  travel: { id: 'travel-test' },
  resources: [],
} as unknown as ValidatedTravelPackage

let repository: TravelLibraryRepository

beforeEach(() => {
  importTravelPackageMock.mockReset()
  repository = {
    importPackage: vi.fn(),
    listTravels: vi.fn(),
    getTravel: vi.fn(),
    getResource: vi.fn(),
    deleteTravel: vi.fn(),
    close: vi.fn(),
  }
})

describe('importTravelPackageToLibrary', () => {
  it('ne tente aucune écriture si la chaîne d’import refuse le paquet', async () => {
    importTravelPackageMock.mockResolvedValue({
      ok: false,
      kind: 'validation',
      errors: [
        {
          kind: 'validation',
          code: 'JSON_INVALID',
          message: 'voyage.json est invalide.',
          hint: 'Corrigez le fichier.',
        },
      ],
    })

    const result = await importTravelPackageToLibrary(selectedFile, repository)

    expect(result).toMatchObject({ ok: false, source: 'import' })
    expect(repository.importPackage).not.toHaveBeenCalled()
  })

  it('transmet uniquement le paquet entièrement validé au dépôt', async () => {
    importTravelPackageMock.mockResolvedValue({ ok: true, package: validatedPackage })
    vi.mocked(repository.importPackage).mockResolvedValue({
      ok: true,
      value: {
        travelId: 'travel-test',
        packageId: 'travel-test',
        title: 'Voyage test',
      },
    } as Awaited<ReturnType<TravelLibraryRepository['importPackage']>>)

    const result = await importTravelPackageToLibrary(selectedFile, repository)

    expect(repository.importPackage).toHaveBeenCalledWith(validatedPackage)
    expect(result).toMatchObject({ ok: true, entry: { travelId: 'travel-test' } })
  })

  it('propage une erreur de persistance sans annoncer de réussite', async () => {
    importTravelPackageMock.mockResolvedValue({ ok: true, package: validatedPackage })
    vi.mocked(repository.importPackage).mockResolvedValue({
      ok: false,
      error: {
        code: 'TRAVEL_ALREADY_EXISTS',
        message: 'Voyage déjà présent.',
        hint: 'Supprimez-le avant réimport.',
        travelId: 'travel-test',
      },
    })

    const result = await importTravelPackageToLibrary(selectedFile, repository)

    expect(result).toMatchObject({
      ok: false,
      source: 'persistence',
      error: { code: 'TRAVEL_ALREADY_EXISTS' },
    })
  })
})
