import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistedTravel } from '../../persistence/model'
import { TravelConsultation, type TravelView } from './TravelConsultation'
import {
  consultationTravel,
  fixedClock,
  persistedConsultationTravel,
} from './testFixtures'

afterEach(() => cleanup())

function ConsultationHarness({
  travel = persistedConsultationTravel,
  initialView = { kind: 'summary' },
  instant = '2026-07-15T10:00:00Z',
  onBack = vi.fn(),
}: {
  travel?: PersistedTravel
  initialView?: TravelView
  instant?: string
  onBack?: () => void
}) {
  const [view, setView] = useState<TravelView>(initialView)
  return (
    <TravelConsultation
      persistedTravel={travel}
      view={view}
      clock={fixedClock(instant)}
      onNavigate={setView}
      onBackToLibrary={onBack}
    />
  )
}

function persistedWith(overrides: Partial<typeof consultationTravel>): PersistedTravel {
  return {
    ...persistedConsultationTravel,
    travel: { ...consultationTravel, ...overrides },
  }
}

describe('synthèse du voyage', () => {
  it('affiche le titre, la destination, les dates et le résumé', () => {
    render(<ConsultationHarness />)

    expect(screen.getByRole('heading', { level: 2, name: 'Escapade Atlantique' })).toBeInTheDocument()
    expect(screen.getByText('La Rochelle')).toBeInTheDocument()
    expect(screen.getByText(consultationTravel.summary)).toBeInTheDocument()
    expect(screen.getAllByText(/mardi 14 juillet 2026/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/vendredi 17 juillet 2026/).length).toBeGreaterThan(0)
  })

  it('liste toutes les journées avec leurs titres et intentions disponibles', () => {
    render(<ConsultationHarness />)

    expect(screen.getByRole('button', { name: /Ouvrir la journée Arrivée au port/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ouvrir la journée Autour du port/ })).toBeInTheDocument()
    expect(screen.getByText('Installation et premiers repères.')).toBeInTheDocument()
  })

  it('affiche un état robuste pour un voyage sans journée', () => {
    render(<ConsultationHarness travel={persistedWith({ days: [] })} />)

    expect(screen.getByText(/ne contient aucune journée/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Journées du voyage' })).not.toBeInTheDocument()
  })

  it('reste lisible lorsque les champs facultatifs sont absents', () => {
    const travel = persistedWith({
      days: [{ ...consultationTravel.days[1], summary: undefined }],
      places: consultationTravel.places.map((place) => ({ ...place, address: undefined })),
    })
    render(<ConsultationHarness travel={travel} />)

    expect(screen.getAllByText('Autour du port').length).toBeGreaterThan(0)
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})

describe('navigation et chronologie', () => {
  it('ouvre une journée depuis la synthèse', () => {
    render(<ConsultationHarness />)
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir la journée Arrivée au port/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeInTheDocument()
    expect(screen.getByText('Vue active : Arrivée au port')).toBeInTheDocument()
  })

  it('navigue vers la journée suivante', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)
    fireEvent.click(screen.getByRole('button', { name: /Journée suivante : Autour du port/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
  })

  it('navigue vers la journée précédente', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-island' }} />)
    fireEvent.click(screen.getByRole('button', { name: /Journée précédente : Autour du port/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
  })

  it('revient à la synthèse depuis une journée', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Synthèse' }))

    expect(screen.getByText('Vue active : Synthèse du voyage')).toBeInTheDocument()
  })

  it('déclenche le retour à la bibliothèque', () => {
    const onBack = vi.fn()
    render(<ConsultationHarness onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('rend les étapes dans l’ordre du modèle normalisé', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)
    const timeline = screen.getByRole('heading', { name: 'Déroulement chronologique' }).parentElement
    const headings = within(timeline as HTMLElement).getAllByRole('heading', { level: 4 })

    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Passage au marché',
      'Installation',
      'Pause libre',
    ])
  })

  it('conserve une étape sans lui inventer d’heure', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByText('Pause libre')).toBeInTheDocument()
    expect(screen.getByText('Sans horaire indiqué')).toBeInTheDocument()
  })

  it('explique une journée sans étape', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)

    expect(screen.getByText(/aucune étape n’est renseignée/i)).toBeInTheDocument()
  })

  it('signale la journée sélectionnée autrement que par la couleur', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const selected = screen.getByRole('button', { name: /Arrivée au port.*Journée sélectionnée/ })
    expect(selected).toHaveAttribute('aria-current', 'page')
  })
})

describe('hébergement pertinent', () => {
  it('affiche l’hébergement de la date consultée', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByText('Maison du port')).toBeInTheDocument()
    expect(screen.queryByText('Escale insulaire')).not.toBeInTheDocument()
  })

  it('change d’hébergement pour une période successive', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-island' }} />)

    expect(screen.getByText('Escale insulaire')).toBeInTheDocument()
    expect(screen.queryByText('Maison du port')).not.toBeInTheDocument()
  })

  it('gère explicitement une journée sans hébergement', () => {
    render(<ConsultationHarness travel={persistedWith({ accommodations: [] })} initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByText(/aucun hébergement n’est indiqué/i)).toBeInTheDocument()
  })
})

describe('vue Aujourd’hui', () => {
  it('affiche la journée locale pendant le voyage', () => {
    render(<ConsultationHarness instant="2026-07-15T10:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
    expect(screen.getByText('Vue active : Aujourd’hui')).toBeInTheDocument()
  })

  it('explique que le voyage n’a pas commencé', () => {
    render(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-07-01T10:00:00Z" />)

    expect(screen.getByText(/n’a pas encore commencé/i)).toBeInTheDocument()
  })

  it('explique que le voyage est terminé', () => {
    render(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-07-20T10:00:00Z" />)

    expect(screen.getByText(/voyage est terminé/i)).toBeInTheDocument()
  })

  it('explique l’absence de journée pour une date comprise dans le séjour', () => {
    render(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-07-17T10:00:00Z" />)

    expect(screen.getByText(/aucune journée n’est prévue/i)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Journées du voyage' })).toBeInTheDocument()
  })
})

describe('accessibilité de consultation', () => {
  it('expose des libellés explicites pour les contrôles principaux', () => {
    render(<ConsultationHarness />)

    expect(screen.getByRole('navigation', { name: 'Vues du voyage' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Journées du voyage' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir la vue Aujourd’hui' })).toBeInTheDocument()
  })

  it('permet de placer le focus clavier sur les contrôles natifs', () => {
    render(<ConsultationHarness />)
    const button = screen.getByRole('button', { name: 'Aujourd’hui' })

    button.focus()
    expect(button).toHaveFocus()
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    expect(screen.getByText('Vue active : Aujourd’hui')).toBeInTheDocument()
  })

  it('n’utilise aucune surface d’exécution pour le HTML importé', async () => {
    const source = await import('./TravelConsultation.tsx?raw')

    expect(source.default).not.toMatch(/dangerouslySetInnerHTML|innerHTML|<iframe|\beval\s*\(|\bFunction\s*\(/)
    expect(source.default).not.toContain('guide-standalone.html')
  })
})
