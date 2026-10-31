import { useState } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Travel } from '../../domain/voyage/model'
import { TravelConsultation, type TravelView } from './TravelConsultation'
import {
  consultationTravel,
  fixedClock,
  persistedConsultationTravel,
} from './testFixtures'

afterEach(() => {
  cleanup()
})

function PiecesHarness({
  travel = consultationTravel,
  initialView = { kind: 'pieces' },
  localResourceIds = ['pdf-booking'],
  onListLocalResourceIds = vi.fn().mockResolvedValue(localResourceIds),
  onOpenDocument = vi.fn(),
  online = true,
}: {
  travel?: Travel
  initialView?: TravelView
  localResourceIds?: readonly string[] | undefined
  onListLocalResourceIds?: (travelId: string) => Promise<readonly string[] | undefined>
  onOpenDocument?: (document: Travel['documents'][number]) => void
  online?: boolean
}) {
  const [view, setView] = useState<TravelView>(initialView)
  return (
    <TravelConsultation
      persistedTravel={{ ...persistedConsultationTravel, travel }}
      view={view}
      clock={fixedClock('2026-07-15T10:00:00Z')}
      online={online}
      personalState={{ checkedItemKeys: [], note: '' }}
      onNavigate={setView}
      onBackToLibrary={vi.fn()}
      onCopyAddress={vi.fn().mockResolvedValue(true)}
      onOpenDocument={onOpenDocument}
      onLoadIllustrationResource={vi.fn().mockResolvedValue({ ok: false, message: '' })}
      onListLocalResourceIds={onListLocalResourceIds}
      userPieces={[]}
      onAddUserPiece={vi.fn()}
      onRenameUserPiece={vi.fn()}
      onDeleteUserPiece={vi.fn()}
      onOpenUserPiece={vi.fn()}
      onLoadUserPieceFile={vi.fn()}
      onSetChecklistItemChecked={vi.fn().mockResolvedValue({ ok: true })}
      onSaveNote={vi.fn().mockResolvedValue({ ok: true })}
    />
  )
}

describe('espace Pièces', () => {
  it('place Pièces entre Programme et Préparation dans la navigation du bas', () => {
    render(<PiecesHarness initialView={{ kind: 'summary' }} />)
    const navigation = screen.getByRole('navigation', { name: 'Sections du voyage' })
    const buttons = within(navigation).getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual([
      'Aperçu',
      'Programme',
      'Pièces',
      'Préparation',
    ])

    fireEvent.click(within(navigation).getByRole('button', { name: 'Pièces' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
    expect(within(navigation).getByRole('button', { name: 'Pièces' }))
      .toHaveAttribute('aria-current', 'page')
  })

  it('liste chaque pièce une fois, regroupée par jour, avec ses rattachements', async () => {
    render(<PiecesHarness />)

    expect(screen.getByText('2 pièces')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Tout le voyage' })).not.toBeInTheDocument()
    const day = screen.getByRole('region', { name: 'mar. 14 juil. Arrivée au port' })
    const rows = [...day.querySelectorAll('.pieces-list > li')] as HTMLElement[]
    expect(rows).toHaveLength(2)
    expect(document.querySelectorAll('.piece-title')).toHaveLength(2)
    expect(within(rows[0]!).getByText('Confirmation d’hébergement')).toHaveClass('piece-title')
    expect(within(rows[0]!).getByText(
      /Étape 14:00 · Installation ; Toute la journée · mer\. 15 juil\./,
    )).toBeVisible()
    expect(within(rows[0]!).getByText('PDF')).toBeVisible()
    expect(within(rows[0]!).getByText('Dossier')).toBeVisible()
    expect(within(rows[1]!).getByText('Réservation')).toBeVisible()
    await screen.findByText('Toutes disponibles hors connexion')
  })

  it('ouvre la fiche d’un document depuis sa ligne sans ouvrir le PDF', () => {
    const onOpenDocument = vi.fn()
    render(<PiecesHarness onOpenDocument={onOpenDocument} />)

    fireEvent.click(screen.getByRole('button', {
      name: 'Voir la fiche Confirmation d’hébergement — '
        + 'Étape 14:00 · Installation ; Toute la journée · mer. 15 juil. — PDF, Dossier',
    }))

    expect(screen.getByRole('heading', { level: 2, name: 'Confirmation d’hébergement' }))
      .toBeVisible()
    expect(onOpenDocument).not.toHaveBeenCalled()
  })

  it('ouvre la fiche d’une réservation depuis sa ligne', () => {
    render(<PiecesHarness />)

    fireEvent.click(screen.getByRole('button', {
      name: /^Voir la fiche Réservation Maison du port — /,
    }))

    expect(screen.getByRole('heading', { level: 2, name: 'Réservation Maison du port' }))
      .toBeVisible()
    expect(screen.getByText('PORT-2026')).toBeVisible()
  })

  it('range dans « Tout le voyage » une pièce sans rattachement', () => {
    render(
      <PiecesHarness
        travel={{
          ...consultationTravel,
          documents: [
            ...consultationTravel.documents,
            { id: 'document-insurance', label: 'Assurance', resourceId: 'pdf-insurance' },
          ],
        }}
      />,
    )

    const travelGroup = screen.getByRole('region', { name: 'Tout le voyage' })
    expect(within(travelGroup).getByText('Assurance')).toBeVisible()
    expect(document.querySelector('.pieces-group')).toBe(travelGroup)
  })

  it('demande les ressources du seul voyage courant', async () => {
    const onListLocalResourceIds = vi.fn().mockResolvedValue(['pdf-booking'])
    render(<PiecesHarness onListLocalResourceIds={onListLocalResourceIds} />)

    await waitFor(() => expect(onListLocalResourceIds).toHaveBeenCalledWith(
      consultationTravel.id,
    ))
  })

  it('n’affiche pas le badge hors connexion quand un PDF manque sur l’appareil', async () => {
    render(<PiecesHarness localResourceIds={[]} />)

    expect(await screen.findByText('Absent de cet appareil')).toBeVisible()
    expect(screen.queryByText('Toutes disponibles hors connexion')).not.toBeInTheDocument()
  })

  it('n’affiche pas le badge quand le stockage local ne peut pas être lu', async () => {
    const onListLocalResourceIds = vi.fn().mockResolvedValue(undefined)
    render(<PiecesHarness onListLocalResourceIds={onListLocalResourceIds} />)

    await waitFor(() => expect(onListLocalResourceIds).toHaveBeenCalled())
    expect(screen.queryByText('Toutes disponibles hors connexion')).not.toBeInTheDocument()
    expect(screen.queryByText('Absent de cet appareil')).not.toBeInTheDocument()
  })

  it('affiche un état vide explicite sans section pour un voyage sans pièce', () => {
    render(
      <PiecesHarness
        travel={{
          ...consultationTravel,
          documents: [],
          reservations: [],
          days: consultationTravel.days.map((day) => ({
            ...day,
            documentIds: [],
            reservationIds: [],
            steps: day.steps.map((step) => ({ ...step, documentIds: [], reservationIds: [] })),
          })),
        }}
      />,
    )

    expect(screen.getByText(/ne contient aucun document ni aucune réservation/)).toBeVisible()
    expect(document.querySelectorAll('.pieces-group')).toHaveLength(0)
    expect(screen.queryByText('Toutes disponibles hors connexion')).not.toBeInTheDocument()
  })
})

describe('pièces du jour', () => {
  it('présente une bande des pièces de la journée avec un accès à l’espace Pièces', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const strip = screen.getByRole('region', { name: 'Pièces du jour · 2' })
    const cards = within(strip).getAllByRole('button', { name: /^Voir la fiche/ })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveAccessibleName(
      'Voir la fiche Confirmation d’hébergement — Étape 14:00 · Installation — PDF, Dossier',
    )

    fireEvent.click(within(strip).getByRole('button', { name: 'Toutes les pièces' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
  })

  it('mène chaque carte à la fiche de sa pièce', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)
    const strip = screen.getByRole('region', { name: 'Pièces du jour · 2' })

    fireEvent.click(within(strip).getByRole('button', {
      name: /^Voir la fiche Réservation Maison du port/,
    }))

    expect(screen.getByRole('heading', { level: 2, name: 'Réservation Maison du port' }))
      .toBeVisible()
    expect(screen.getByRole('button', { name: 'Pièces' })).toHaveAttribute('aria-current', 'page')
  })

  it('ne répète plus les pièces de la journée dans ses compléments', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)

    expect(screen.getByRole('region', { name: 'Pièces du jour · 2' })).toBeVisible()
    expect(screen.queryByText('Informations associées à la journée')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Confirmation d’hébergement/ }))
      .toHaveLength(1)
  })

  it('n’affiche aucune bande pour une journée sans pièce', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-island' }} />)

    expect(screen.queryByText(/Pièces du jour/)).not.toBeInTheDocument()
  })
})

describe('espace de l’étape', () => {
  it('s’ouvre en touchant l’étape puis revient à sa journée', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’étape Installation' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Installation' })).toBeVisible()
    expect(screen.getByText('Jour 1 sur 3')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Programme' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'Retour à la journée : Arrivée au port' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeVisible()
  })

  it('présente horaire, lieu, réservation, pièces et liens sans répétition', () => {
    const onOpenDocument = vi.fn()
    render(
      <PiecesHarness
        initialView={{ kind: 'step', stepId: 'step-check-in' }}
        onOpenDocument={onOpenDocument}
      />,
    )

    const header = screen.getByRole('heading', { level: 2, name: 'Installation' })
      .closest('header') as HTMLElement
    expect(within(header).getByText('14:00')).toBeVisible()
    expect(within(header).getByText('Vieux-Port')).toBeVisible()
    const reservation = screen.getByRole('heading', { name: 'Réservation Maison du port' })
      .closest('.reservation-card') as HTMLElement
    expect(within(reservation).getByText('PORT-2026')).toBeVisible()
    expect(within(reservation).getByText('Confirmée')).toBeVisible()
    expect(within(reservation).queryByRole('button', { name: /Ouvrir le document/ }))
      .not.toBeInTheDocument()

    const links = screen.getByRole('region', { name: 'Liens utiles' })
    expect(within(links).getByRole('link', { name: /Ouvrir l’itinéraire vers le Vieux-Port/ }))
      .toHaveAttribute('href', 'https://example.com/route/port')
    expect(screen.getAllByRole('link', { name: /Ouvrir l’itinéraire vers le Vieux-Port/ }))
      .toHaveLength(1)

    const pieces = screen.getByRole('region', { name: 'Pièces de cette étape · 1' })
    fireEvent.click(within(pieces).getByRole('button', {
      name: 'Voir la fiche Confirmation d’hébergement — Document du dossier — PDF, Dossier',
    }))
    expect(screen.getByRole('heading', { level: 2, name: 'Confirmation d’hébergement' }))
      .toBeVisible()
    expect(onOpenDocument).not.toHaveBeenCalled()
  })

  it('n’affiche pas de référence ni de section absente des données', () => {
    render(<PiecesHarness initialView={{ kind: 'step', stepId: 'step-flexible' }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Pause libre' })).toBeVisible()
    expect(screen.getByText('Sans horaire')).toBeVisible()
    expect(screen.queryByText('Référence')).not.toBeInTheDocument()
    const pieces = screen.getByRole('region', { name: 'Pièces de cette étape' })
    expect(within(pieces).queryByRole('list')).not.toBeInTheDocument()
    expect(within(pieces).getByRole('button', { name: 'Ajouter une pièce à cette étape' }))
      .toBeVisible()
    expect(screen.queryByText('Liens utiles')).not.toBeInTheDocument()
  })

  it('revient à l’aperçu pour une étape inconnue', () => {
    render(<PiecesHarness initialView={{ kind: 'step', stepId: 'step-missing' }} />)

    expect(screen.getByRole('button', { name: 'Aperçu' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('fiche d’une pièce', () => {
  const documentSheet: TravelView = {
    kind: 'piece',
    pieceKind: 'document',
    pieceId: 'document-booking',
  }

  it('présente un document du dossier en lecture seule, sans aperçu factice', async () => {
    const onOpenDocument = vi.fn()
    const { container } = render(
      <PiecesHarness initialView={documentSheet} onOpenDocument={onOpenDocument} />,
    )
    const sheet = container.querySelector('.piece-sheet') as HTMLElement

    expect(within(sheet).getByRole('heading', { level: 2, name: 'Confirmation d’hébergement' }))
      .toBeVisible()
    expect(within(sheet).getAllByText('PDF').length).toBeGreaterThan(0)
    expect(within(sheet).getByText('PDF enregistré avec le voyage.')).toBeVisible()
    expect(sheet.querySelector('img, iframe, object, embed, [role="img"]')).toBeNull()
    expect(within(sheet).getByText('Fournie avec le dossier du voyage')).toBeVisible()
    expect(within(sheet).getByText(/^Pièce du dossier : en lecture seule\./)).toBeVisible()
    expect(within(sheet).queryByRole('button', { name: /Renommer|Supprimer/ }))
      .not.toBeInTheDocument()
    expect(await within(sheet).findByText('Sur cet appareil, disponible hors connexion'))
      .toBeVisible()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Ouvrir le PDF Confirmation d’hébergement' }))
    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])
  })

  it('signale un PDF absent ou un stockage non vérifiable', async () => {
    render(<PiecesHarness initialView={documentSheet} localResourceIds={[]} />)
    expect(await screen.findByText('Absent de cet appareil')).toBeVisible()
    cleanup()

    const onListLocalResourceIds = vi.fn().mockResolvedValue(undefined)
    render(
      <PiecesHarness initialView={documentSheet} onListLocalResourceIds={onListLocalResourceIds} />,
    )
    await waitFor(() => expect(onListLocalResourceIds).toHaveBeenCalled())
    expect(screen.getByText('Stockage local du voyage, non vérifié')).toBeVisible()
  })

  it('mène vers chaque rattachement et vers l’espace Pièces', () => {
    render(<PiecesHarness initialView={documentSheet} />)
    const attachments = screen.getByRole('region', { name: 'Rattachée à' })

    fireEvent.click(within(attachments).getByRole('button', {
      name: 'Voir l’étape Étape 14:00 · Installation — Mar. 14 juil. · Arrivée au port',
    }))
    expect(screen.getByRole('heading', { level: 2, name: 'Installation' })).toBeVisible()

    cleanup()
    render(<PiecesHarness initialView={documentSheet} />)
    fireEvent.click(screen.getByRole('button', {
      name: 'Voir la journée Mer. 15 juil. — Autour du port',
    }))
    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeVisible()

    cleanup()
    render(<PiecesHarness initialView={documentSheet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Toutes les pièces du voyage' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
  })

  it('rattache au voyage entier une pièce sans journée ni étape', () => {
    render(
      <PiecesHarness
        travel={{
          ...consultationTravel,
          documents: [
            ...consultationTravel.documents,
            { id: 'document-insurance', label: 'Assurance', resourceId: 'pdf-insurance' },
          ],
        }}
        initialView={{ kind: 'piece', pieceKind: 'document', pieceId: 'document-insurance' }}
      />,
    )
    const attachments = screen.getByRole('region', { name: 'Rattachée à' })

    expect(within(attachments).getByText('Tout le voyage')).toBeVisible()
    expect(within(attachments).getAllByRole('button')).toHaveLength(1)
  })

  it('présente une réservation avec son bloc structuré, sans bouton PDF propre', () => {
    const { container } = render(
      <PiecesHarness
        initialView={{ kind: 'piece', pieceKind: 'reservation', pieceId: 'reservation-stay' }}
      />,
    )
    const sheet = container.querySelector('.piece-sheet') as HTMLElement

    expect(within(sheet).getByRole('heading', { level: 2, name: 'Réservation Maison du port' }))
      .toBeVisible()
    expect(within(sheet).getByText('PORT-2026')).toBeVisible()
    expect(within(sheet).getByText('Enregistrée avec le voyage sur cet appareil')).toBeVisible()
    expect(within(sheet).queryByRole('button', { name: /^Ouvrir le PDF/ })).not.toBeInTheDocument()
  })

  it('revient aux pièces du voyage et à l’aperçu pour une pièce inconnue', () => {
    render(<PiecesHarness initialView={documentSheet} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux pièces du voyage' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()

    cleanup()
    render(
      <PiecesHarness initialView={{ kind: 'piece', pieceKind: 'document', pieceId: 'missing' }} />,
    )
    expect(screen.getByRole('button', { name: 'Aperçu' })).toHaveAttribute('aria-current', 'page')
  })
})
