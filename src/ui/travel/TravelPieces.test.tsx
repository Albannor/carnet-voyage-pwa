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
