import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Travel } from '../domain/voyage/model'
import type { TravelLibraryEntry } from '../persistence/model'
import type {
  TravelLibraryRepository,
  TravelRepositoryFactory,
} from '../persistence/repository'
import { App } from './App'
import { TEST_PDF_BYTES } from '../import/test/packageFixtures'
import { persistedConsultationTravel } from './travel/testFixtures'
import type { ConnectivityAdapter } from '../services/connectivity'

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
  documents: [],
  reservations: [],
  checklists: [],
  illustrations: [],
}

let repository: TravelLibraryRepository
let repositoryFactory: TravelRepositoryFactory

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  importToLibraryMock.mockReset()
  repository = {
    importPackage: vi.fn(),
    listTravels: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getTravel: vi.fn().mockResolvedValue({
      ok: true,
      value: { metadata: entry, travel },
    }),
    getResource: vi.fn(),
    listResourceIds: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    listUserPieces: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getUserPieceFile: vi.fn(),
    addUserPiece: vi.fn(),
    renameUserPiece: vi.fn(),
    deleteUserPiece: vi.fn(),
    getPersonalState: vi.fn().mockResolvedValue({
      ok: true,
      value: { checkedItemKeys: [], note: '' },
    }),
    setChecklistItemChecked: vi.fn(),
    saveTravelNote: vi.fn(),
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
    expect(await screen.findByText('Votre carnet est vide')).toBeInTheDocument()
    expect(screen.getByLabelText('Choisir un fichier ZIP')).toHaveAttribute(
      'accept',
      expect.stringContaining('.zip'),
    )
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute(
      'href',
      '#contenu-principal',
    )
  })

  it('annonce les transitions réseau sans masquer la bibliothèque locale', async () => {
    let notify: ((online: boolean) => void) | undefined
    const connectivity: ConnectivityAdapter = {
      isOnline: () => true,
      subscribe: (listener) => {
        notify = listener
        return () => undefined
      },
    }
    render(
      <App
        repositoryFactory={repositoryFactory}
        connectivity={connectivity}
      />,
    )

    expect(await screen.findByText('Votre carnet est vide')).toBeInTheDocument()
    expect(screen.queryByText('Hors connexion.')).not.toBeInTheDocument()

    act(() => notify?.(false))

    expect(screen.getByText('Hors connexion.')).toBeInTheDocument()
    expect(screen.getByText(/contenus enregistrés restent consultables/)).toBeInTheDocument()
    expect(screen.getByText('Votre carnet est vide')).toBeInTheDocument()

    act(() => notify?.(true))
    expect(screen.queryByText('Hors connexion.')).not.toBeInTheDocument()
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
    await screen.findByText('Votre carnet est vide')

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
    await screen.findByText('Votre carnet est vide')

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
    await screen.findByText('Votre carnet est vide')

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
    await screen.findByText('Votre carnet est vide')

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
    expect(screen.getByText('Section active : Aperçu')).toBeInTheDocument()
    expect(window.location.search).toContain('travel=travel-alpha')
    fireEvent.click(
      screen.getByRole('button', { name: 'Retour à la bibliothèque' }),
    )
    expect(
      screen.getByRole('button', { name: 'Ouvrir Voyage alpha' }),
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
    expect(await screen.findByText('Votre carnet est vide')).toBeInTheDocument()
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

  it('récupère et ouvre un PDF depuis le périmètre du voyage consulté', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [persistedConsultationTravel.metadata],
    })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: persistedConsultationTravel,
    })
    vi.mocked(repository.getResource).mockResolvedValue({
      ok: true,
      value: {
        travelId: persistedConsultationTravel.travel.id,
        resourceId: 'pdf-booking',
        path: 'documents/booking.pdf',
        mediaType: 'application/pdf',
        size: TEST_PDF_BYTES.length,
        sha256: 'a'.repeat(64),
        bytes: TEST_PDF_BYTES,
      },
    })
    const platformActions = {
      copyText: vi.fn().mockResolvedValue(true),
      openLocalPdf: vi.fn().mockReturnValue(true),
    }
    render(<App repositoryFactory={repositoryFactory} platformActions={platformActions} />)

    fireEvent.click(await screen.findByRole('button', { name: /Ouvrir Escapade Atlantique/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Programme' }))
    const daySelector = await screen.findByRole('navigation', { name: 'Choisir une journée' })
    fireEvent.click(within(daySelector).getByRole('button', { name: /Arrivée au port/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’étape Installation' }))
    fireEvent.click(screen.getByRole('button', { name: /^Voir la fiche Confirmation d’hébergement/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le PDF Confirmation d’hébergement' }))

    await waitFor(() => expect(repository.getResource).toHaveBeenCalledWith(
      persistedConsultationTravel.travel.id,
      'pdf-booking',
    ))
    expect(platformActions.openLocalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'pdf-booking' }),
      'Confirmation d’hébergement',
    )
    expect(await screen.findByText(/Ouverture du document local/)).toBeInTheDocument()
  })

  it('charge les pièces ajoutées du voyage et ouvre leur PDF local', async () => {
    const piece = {
      travelId: persistedConsultationTravel.travel.id,
      pieceId: 'added-ticket',
      version: 1 as const,
      title: 'Billet ajouté',
      kind: 'transport' as const,
      attachment: { type: 'travel' as const },
      mediaType: 'application/pdf' as const,
      size: TEST_PDF_BYTES.length,
      createdAt: '2026-07-10T09:00:00.000Z',
      updatedAt: '2026-07-10T09:00:00.000Z',
    }
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [persistedConsultationTravel.metadata],
    })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: persistedConsultationTravel,
    })
    vi.mocked(repository.listUserPieces).mockResolvedValue({ ok: true, value: [piece] })
    vi.mocked(repository.getUserPieceFile).mockResolvedValue({
      ok: true,
      value: {
        travelId: piece.travelId,
        pieceId: piece.pieceId,
        mediaType: 'application/pdf',
        bytes: TEST_PDF_BYTES,
      },
    })
    const platformActions = {
      copyText: vi.fn().mockResolvedValue(true),
      openLocalPdf: vi.fn().mockReturnValue(true),
    }
    render(<App repositoryFactory={repositoryFactory} platformActions={platformActions} />)

    fireEvent.click(await screen.findByRole('button', { name: /Ouvrir Escapade Atlantique/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pièces' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Voir la fiche Billet ajouté/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le PDF Billet ajouté' }))

    expect(repository.listUserPieces).toHaveBeenCalledWith(persistedConsultationTravel.travel.id)
    await waitFor(() => expect(repository.getUserPieceFile).toHaveBeenCalledWith(
      persistedConsultationTravel.travel.id,
      'added-ticket',
    ))
    expect(platformActions.openLocalPdf).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'application/pdf', bytes: TEST_PDF_BYTES }),
      'Billet ajouté',
    )
  })

  it('signale à côté du bouton une copie d’adresse impossible', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [persistedConsultationTravel.metadata],
    })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: persistedConsultationTravel,
    })
    const platformActions = {
      copyText: vi.fn().mockResolvedValue(false),
      openLocalPdf: vi.fn(),
    }
    render(<App repositoryFactory={repositoryFactory} platformActions={platformActions} />)

    fireEvent.click(await screen.findByRole('button', { name: /Ouvrir Escapade Atlantique/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pièces' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copier l’adresse de Maison du port' }))

    expect(await screen.findByText('Copie impossible sur cet appareil')).toBeInTheDocument()
    expect(platformActions.copyText).toHaveBeenCalledWith('Quai du Carénage')
    expect(screen.queryByText('Adresse copiée')).not.toBeInTheDocument()
  })

  it('relie les checklists et la note au dépôt du voyage courant', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [persistedConsultationTravel.metadata],
    })
    vi.mocked(repository.getTravel).mockResolvedValue({
      ok: true,
      value: persistedConsultationTravel,
    })
    vi.mocked(repository.getPersonalState).mockResolvedValue({
      ok: true,
      value: { checkedItemKeys: [], note: 'Note locale existante' },
    })
    vi.mocked(repository.setChecklistItemChecked).mockResolvedValue({ ok: true, value: undefined })
    vi.mocked(repository.saveTravelNote).mockResolvedValue({ ok: true, value: undefined })
    render(<App repositoryFactory={repositoryFactory} />)

    fireEvent.click(await screen.findByRole('button', { name: /Ouvrir Escapade Atlantique/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Préparation' }))
    const checkbox = await screen.findByRole('checkbox', { name: 'Prendre les pièces d’identité' })
    fireEvent.click(checkbox)
    await waitFor(() => expect(repository.setChecklistItemChecked).toHaveBeenCalledWith(
      persistedConsultationTravel.travel.id,
      'checklist-travel',
      'item-passport',
      true,
    ))

    const note = screen.getByRole('textbox', { name: 'Note générale du voyage' })
    expect(note).toHaveValue('Note locale existante')
    fireEvent.change(note, { target: { value: 'Dernière note' } })
    fireEvent.blur(note)
    await waitFor(() => expect(repository.saveTravelNote).toHaveBeenCalledWith(
      persistedConsultationTravel.travel.id,
      'Dernière note',
    ))
  })

  it('supprime un voyage seulement après confirmation dans « Plus d’options »', async () => {
    vi.mocked(repository.listTravels)
      .mockResolvedValueOnce({ ok: true, value: [entry] })
      .mockResolvedValueOnce({ ok: true, value: [] })
    vi.mocked(repository.deleteTravel).mockResolvedValue({
      ok: true,
      value: undefined,
    })
    render(<App repositoryFactory={repositoryFactory} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Plus d’options pour Voyage alpha' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Voyage alpha' }))
    const confirmation = screen.getByRole('group', { name: 'Supprimer « Voyage alpha » ?' })
    expect(confirmation).toHaveTextContent(/notes, checklists et pièces ajoutées/i)
    expect(repository.deleteTravel).not.toHaveBeenCalled()

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() =>
      expect(repository.deleteTravel).toHaveBeenCalledWith('travel-alpha'),
    )
    expect(await screen.findByText('« Voyage alpha » a été supprimé.')).toBeInTheDocument()
    expect(screen.getByText('Votre carnet est vide')).toBeInTheDocument()
  })

  it('n’effectue aucune suppression lorsque la confirmation est annulée', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({ ok: true, value: [entry] })
    render(<App repositoryFactory={repositoryFactory} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Plus d’options pour Voyage alpha' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Voyage alpha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(repository.deleteTravel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Ouvrir Voyage alpha' })).toBeInTheDocument()
  })

  it('met en avant le voyage le plus proche et liste les autres de façon compacte', async () => {
    const pastEntry = { ...entry, travelId: 'travel-past', title: 'Voyage passé', startDate: '2026-05-01', endDate: '2026-05-03' }
    const laterEntry = { ...entry, travelId: 'travel-later', title: 'Voyage lointain', startDate: '2027-03-01', endDate: '2027-03-05' }
    vi.mocked(repository.listTravels).mockResolvedValue({
      ok: true,
      value: [pastEntry, laterEntry, entry],
    })
    render(
      <App
        repositoryFactory={repositoryFactory}
        clock={{ now: () => new Date(2026, 8, 20, 12) }}
      />,
    )

    const featured = await screen.findByRole('region', { name: 'Prochain voyage' })
    expect(within(featured).getByRole('heading', { level: 3, name: 'Voyage alpha' }))
      .toBeInTheDocument()
    expect(within(featured).getByText('À venir')).toBeInTheDocument()

    const others = screen.getByRole('region', { name: 'Autres voyages · 2' })
    const rows = within(others).getAllByRole('listitem')
    expect(rows.map((row) => within(row).getAllByRole('button')[0]))
      .toEqual([
        within(others).getByRole('button', { name: 'Ouvrir Voyage lointain' }),
        within(others).getByRole('button', { name: 'Ouvrir Voyage passé' }),
      ])
  })

  it('présente une barre compacte dont le bouton rond ouvre le sélecteur ZIP', async () => {
    vi.mocked(repository.listTravels).mockResolvedValue({ ok: true, value: [entry] })
    render(<App repositoryFactory={repositoryFactory} />)

    const importButton = await screen.findByRole('button', { name: 'Importer un voyage' })
    const input = screen.getByLabelText('Choisir un fichier ZIP')
    const click = vi.spyOn(input, 'click')

    fireEvent.click(importButton)

    expect(click).toHaveBeenCalledOnce()
    expect(screen.getByText('Disponible hors connexion')).toBeInTheDocument()
  })

  it('guide une première importation avec un langage simple', async () => {
    render(<App repositoryFactory={repositoryFactory} />)

    expect(await screen.findByRole('heading', { level: 2, name: 'Votre carnet est vide' }))
      .toBeInTheDocument()
    const steps = within(screen.getByRole('region', { name: 'Comment ça marche' }))
      .getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveTextContent('Préparez le voyage avec la Fabrique')
    expect(steps[1]).toHaveTextContent('Récupérez le fichier ZIP')
    expect(steps[2]).toHaveTextContent('Importez-le ici')
    expect(screen.getByText('Format accepté').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('Choisir un fichier ZIP')).toHaveAccessibleDescription(
      /25 Mio maximum/,
    )
    const principles = screen.getByRole('list', { name: 'Principes du carnet' })
    expect(within(principles).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual([
        expect.stringMatching(/^Sur l’appareil/),
        expect.stringMatching(/^Hors connexion/),
        expect.stringMatching(/^Sans compte/),
      ])
    expect(document.body).not.toHaveTextContent(/IndexedDB|ressources passives/)
  })
})
