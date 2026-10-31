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
      onSetChecklistItemChecked={vi.fn().mockResolvedValue({ ok: true })}
      onSaveNote={vi.fn().mockResolvedValue({ ok: true })}
    />
  )
}

describe('espace Pièces', () => {
  it('ajoute Pièces entre Programme et Pratique dans la navigation du bas', () => {
    render(<PiecesHarness initialView={{ kind: 'summary' }} />)
    const navigation = screen.getByRole('navigation', { name: 'Sections du voyage' })
    const buttons = within(navigation).getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual([
      'Aperçu',
      'Programme',
      'Pièces',
      'Pratique',
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

  it('ouvre le document local depuis sa ligne', () => {
    const onOpenDocument = vi.fn()
    render(<PiecesHarness onOpenDocument={onOpenDocument} />)

    fireEvent.click(screen.getByRole('button', {
      name: 'Ouvrir le document Confirmation d’hébergement — '
        + 'Étape 14:00 · Installation ; Toute la journée · mer. 15 juil. — PDF, Dossier',
    }))

    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])
  })

  it('déplie la réservation dans son bloc structuré', () => {
    render(<PiecesHarness />)
    const summary = screen.getByLabelText(/^Voir la réservation Réservation Maison du port — /)
    expect(summary.tagName).toBe('SUMMARY')

    fireEvent.click(summary)

    expect(screen.getByText('PORT-2026')).toBeVisible()
    expect(screen.getByText('Confirmée')).toBeVisible()
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
    const cards = within(strip).getAllByRole('button', { name: /Ouvrir le document|Voir la réservation/ })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveAccessibleName(
      'Ouvrir le document Confirmation d’hébergement — Étape 14:00 · Installation — PDF',
    )

    fireEvent.click(within(strip).getByRole('button', { name: 'Toutes les pièces' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
  })

  it('ouvre le PDF depuis une carte et mène une réservation à son étape', () => {
    const onOpenDocument = vi.fn()
    render(
      <PiecesHarness
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        onOpenDocument={onOpenDocument}
      />,
    )
    const strip = screen.getByRole('region', { name: 'Pièces du jour · 2' })

    fireEvent.click(within(strip).getByRole('button', { name: /^Ouvrir le document/ }))
    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])

    fireEvent.click(within(strip).getByRole('button', { name: /^Voir la réservation/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Installation' })).toBeVisible()
  })

  it('ne répète plus les pièces de la journée dans ses compléments', () => {
    render(<PiecesHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)

    expect(screen.getByRole('region', { name: 'Pièces du jour · 2' })).toBeVisible()
    expect(screen.queryByText('Informations associées à la journée')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Ouvrir le document Confirmation/ }))
      .toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^Voir la réservation/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Pièces du voyage' })).toBeVisible()
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

    const pieces = screen.getByRole('region', { name: 'Pièces de cette étape · 1' })
    fireEvent.click(within(pieces).getByRole('button', {
      name: 'Ouvrir le document Confirmation d’hébergement — Document du dossier — PDF, Dossier',
    }))
    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])

    const links = screen.getByRole('region', { name: 'Liens utiles' })
    expect(within(links).getByRole('link', { name: /Ouvrir l’itinéraire vers le Vieux-Port/ }))
      .toHaveAttribute('href', 'https://example.com/route/port')
    expect(screen.getAllByRole('link', { name: /Ouvrir l’itinéraire vers le Vieux-Port/ }))
      .toHaveLength(1)
  })

  it('n’affiche pas de référence ni de section absente des données', () => {
    render(<PiecesHarness initialView={{ kind: 'step', stepId: 'step-flexible' }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Pause libre' })).toBeVisible()
    expect(screen.getByText('Sans horaire')).toBeVisible()
    expect(screen.queryByText('Référence')).not.toBeInTheDocument()
    expect(screen.queryByText(/Pièces de cette étape/)).not.toBeInTheDocument()
    expect(screen.queryByText('Liens utiles')).not.toBeInTheDocument()
  })

  it('revient à l’aperçu pour une étape inconnue', () => {
    render(<PiecesHarness initialView={{ kind: 'step', stepId: 'step-missing' }} />)

    expect(screen.getByRole('button', { name: 'Aperçu' })).toHaveAttribute('aria-current', 'page')
  })
})
