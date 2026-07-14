import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Travel } from '../domain/voyage/model'
import type { TravelLibraryEntry } from '../persistence/model'
import type {
  TravelLibraryRepository,
  TravelRepositoryFactory,
} from '../persistence/repository'
import { App } from './App'

const { importToLibraryMock } = vi.hoisted(() => ({
  importToLibraryMock: vi.fn(),
}))

vi.mock('../application/importTravelPackageToLibrary', () => ({
  importTravelPackageToLibrary: importToLibraryMock,
}))

const selectedFile = new File(['zip'], 'mon-voyage.zip', {
  type: 'application/zip',
})

const entry: TravelLibraryEntry = {
  travelId: 'travel-alpha',
  packageId: 'travel-alpha',
  title: 'Voyage alpha',
  destination: 'Destination alpha',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  sourcePackageVersion: '1.0.0',
  sourceTravelVersion: '1.0.0',
  importedAt: '2026-07-14T12:00:00.000Z',
  storageSchemaVersion: 1,
  internalModelVersion: 1,
}

const travel: Travel = {
  id: entry.travelId,
  contentVersion: '1.0.0',
  title: entry.title,
  destination: { label: entry.destination, countryCode: 'FR' },
  locale: 'fr-FR',
  timeZone: 'Europe/Paris',
  period: { start: entry.startDate, end: entry.endDate },
  summary: 'Résumé minimal du voyage conservé localement.',
  accommodations: [],
  places: [],
  days: [],
  variants: [],
}

let repository: TravelLibraryRepository
let repositoryFactory: TravelRepositoryFactory

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  importToLibraryMock.mockReset()
  repository = {
    importPackage: vi.fn(),
    listTravels: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getTravel: vi.fn(),
    getResource: vi.fn(),
    deleteTravel: vi.fn(),
    close: vi.fn(),
  }
  repositoryFactory = vi.fn().mockResolvedValue({ ok: true, value: repository })
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('charge une bibliothèque vide et présente un sélecteur ZIP accessible', async () => {
    render(<App repositoryFactory={repositoryFactory} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Carnet de voyage' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/aucun voyage enregistré/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Choisir un fichier ZIP')).toHaveAttribute(
      'accept',
      expect.stringContaining('.zip'),
    )
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute(
      'href',
      '#contenu-principal',
    )
  })

  it('recharge l’interface avec les voyages déjà conservés', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [entry],
    })
    const firstRender = render(<App repositoryFactory={repositoryFactory} />)
    expect(
      await screen.findByRole('button', { name: 'Ouvrir Voyage alpha' }),
    ).toBeInTheDocument()
    firstRender.unmount()

    render(<App repositoryFactory={repositoryFactory} />)

    expect(
      await screen.findByRole('button', { name: 'Ouvrir Voyage alpha' }),
    ).toBeInTheDocument()
    expect(repository.listTravels).toHaveBeenCalledTimes(2)
  })

  it('annonce la validation et l’enregistrement du paquet sélectionné', async () => {
    importToLibraryMock.mockReturnValue(new Promise(() => undefined))
    render(<App repositoryFactory={repositoryFactory} />)
    await screen.findByText(/aucun voyage enregistré/i)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Validation et enregistrement de « mon-voyage.zip » en cours',
    )
    expect(screen.getByLabelText('Choisir un fichier ZIP')).toBeDisabled()
  })

  it('annonce la réussite seulement après la persistance et actualise la liste', async () => {
    importToLibraryMock.mockResolvedValue({ ok: true, entry })
    vi.mocked(repository.listTravels)
      .mockResolvedValueOnce({ ok: true, value: [] })
      .mockResolvedValueOnce({ ok: true, value: [entry] })
    render(<App repositoryFactory={repositoryFactory} />)
    await screen.findByText(/aucun voyage enregistré/i)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(await screen.findByText('Voyage enregistré')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ouvrir Voyage alpha' }),
    ).toBeInTheDocument()
  })

  it('affiche une erreur structurée de validation', async () => {
    importToLibraryMock.mockResolvedValue({
      ok: false,
      source: 'import',
      result: {
        ok: false,
        kind: 'resource',
        errors: [
          {
            kind: 'resource',
            code: 'RESOURCE_MISSING',
            message: 'Une ressource déclarée est absente.',
            file: 'assets/cover.png',
            field: '/resources/0/path',
            hint: 'Ajoutez la ressource au paquet.',
          },
        ],
      },
    })
    render(<App repositoryFactory={repositoryFactory} />)
    await screen.findByText(/aucun voyage enregistré/i)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une ressource déclarée est absente.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('assets/cover.png')
  })

  it('explique le refus prudent d’un voyage déjà présent', async () => {
    importToLibraryMock.mockResolvedValue({
      ok: false,
      source: 'persistence',
      error: {
        code: 'TRAVEL_ALREADY_EXISTS',
        message: 'Ce voyage est déjà présent dans la bibliothèque.',
        hint: "Supprimez explicitement l'ancien voyage avant de l'importer de nouveau.",
        travelId: 'travel-alpha',
      },
    })
    render(<App repositoryFactory={repositoryFactory} />)
    await screen.findByText(/aucun voyage enregistré/i)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce voyage est déjà présent',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Supprimez explicitement')
  })

  it('ouvre la synthèse d’un voyage depuis la bibliothèque puis y revient', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({ ok: true, value: [entry] })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: { metadata: entry, travel },
    })
    render(<App repositoryFactory={repositoryFactory} />)
    const openButton = await screen.findByRole('button', {
      name: 'Ouvrir Voyage alpha',
    })

    fireEvent.click(openButton)

    expect(await screen.findByText(travel.summary)).toBeInTheDocument()
    expect(screen.getByText('Vue active : Synthèse du voyage')).toBeInTheDocument()
    expect(window.location.search).toContain('travel=travel-alpha')
    fireEvent.click(
      screen.getByRole('button', { name: 'Retour à la bibliothèque' }),
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ma bibliothèque' }),
    ).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('retrouve au rechargement un voyage identifié dans l’URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/?travel=travel-alpha&view=summary',
    )
    vi.mocked(repository.listTravels).mockResolvedValue({ ok: true, value: [entry] })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: { metadata: entry, travel },
    })

    render(<App repositoryFactory={repositoryFactory} />)

    expect(await screen.findByText(travel.summary)).toBeInTheDocument()
    expect(repository.getTravel).toHaveBeenCalledWith('travel-alpha')
  })

  it('affiche un voyage introuvable tout en permettant le retour', async () => {
    window.history.replaceState(null, '', '/?travel=missing&view=summary')
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: false,
      error: {
        code: 'TRAVEL_NOT_FOUND',
        message: 'Ce voyage est introuvable.',
        hint: 'Revenez à la bibliothèque.',
        travelId: 'missing',
      },
    })

    render(<App repositoryFactory={repositoryFactory} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce voyage est introuvable.')
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }))
    expect(await screen.findByRole('heading', { name: 'Ma bibliothèque' })).toBeInTheDocument()
  })

  it('présente une erreur de lecture IndexedDB sans exposer de trace', async () => {
    window.history.replaceState(null, '', '/?travel=travel-alpha&view=summary')
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: false,
      error: {
        code: 'READ_FAILED',
        message: 'Le voyage ne peut pas être lu.',
        hint: 'Réessayez depuis la bibliothèque.',
        travelId: 'travel-alpha',
      },
    })

    render(<App repositoryFactory={repositoryFactory} />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Le voyage ne peut pas être lu.')
    expect(alert).not.toHaveTextContent('stack')
  })

  it('charge uniquement le voyage sélectionné parmi plusieurs entrées', async () => {
    const secondEntry = { ...entry, travelId: 'travel-beta', title: 'Voyage bêta' }
    const secondTravel = { ...travel, id: 'travel-beta', title: 'Voyage bêta' }
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [entry, secondEntry],
    })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: { metadata: secondEntry, travel: secondTravel },
    })
    render(<App repositoryFactory={repositoryFactory} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir Voyage bêta' }))

    expect(await screen.findByRole('heading', { name: 'Voyage bêta' })).toBeInTheDocument()
    expect(repository.getTravel).toHaveBeenCalledWith('travel-beta')
    expect(screen.queryByRole('heading', { name: 'Voyage alpha' })).not.toBeInTheDocument()
  })

  it('demande une confirmation nommant le voyage avant suppression', async () => {
    vi.mocked(repository.listTravels)
      .mockResolvedValueOnce({ ok: true, value: [entry] })
      .mockResolvedValueOnce({ ok: true, value: [] })
    vi.mocked(repository.deleteTravel).mockResolvedValue({
      ok: true,
      value: undefined,
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App repositoryFactory={repositoryFactory} />)
    const deleteButton = await screen.findByRole('button', {
      name: 'Supprimer Voyage alpha',
    })

    fireEvent.click(deleteButton)

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Voyage alpha'))
    await waitFor(() =>
      expect(repository.deleteTravel).toHaveBeenCalledWith('travel-alpha'),
    )
    expect(await screen.findByText(/aucun voyage enregistré/i)).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('n’effectue aucune suppression lorsque la confirmation est refusée', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({ ok: true, value: [entry] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App repositoryFactory={repositoryFactory} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Supprimer Voyage alpha' }),
    )

    expect(repository.deleteTravel).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})
