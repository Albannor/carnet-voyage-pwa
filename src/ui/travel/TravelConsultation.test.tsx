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
  online = true,
  onCopyAddress = vi.fn(),
  onOpenDocument = vi.fn(),
}: {
  travel?: PersistedTravel
  initialView?: TravelView
  instant?: string
  onBack?: () => void
  online?: boolean
  onCopyAddress?: (address: string, label: string) => void
  onOpenDocument?: (document: typeof consultationTravel.documents[number]) => void
}) {
  const [view, setView] = useState<TravelView>(initialView)
  return (
    <TravelConsultation
      persistedTravel={travel}
      view={view}
      clock={fixedClock(instant)}
      online={online}
      onNavigate={setView}
      onBackToLibrary={onBack}
      onCopyAddress={onCopyAddress}
      onOpenDocument={onOpenDocument}
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

describe('actions contextuelles', () => {
  it('distingue la copie locale, le document local et le service externe', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByRole('button', { name: /Action locale · Copier l’adresse de Marché central/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Document local · Ouvrir Confirmation d’hébergement/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Service externe · Ouvrir l’itinéraire vers le marché/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getAllByText(/Connexion requise/).length).toBeGreaterThan(0)
  })

  it('déclenche la copie de l’adresse avec son contexte explicite', () => {
    const onCopyAddress = vi.fn()
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} onCopyAddress={onCopyAddress} />)

    fireEvent.click(screen.getByRole('button', { name: /Copier l’adresse de Marché central/ }))
    expect(onCopyAddress).toHaveBeenCalledWith('Place du Marché', 'Marché central')
  })

  it('ouvre une réservation et ses documents par leurs associations explicites', () => {
    const onOpenDocument = vi.fn()
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} onOpenDocument={onOpenDocument} />)

    expect(screen.getByRole('heading', { name: 'Réservation Maison du port' })).toBeInTheDocument()
    expect(screen.getByText('PORT-2026')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Ouvrir Confirmation d’hébergement/ })[0]!)
    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])
  })

  it('neutralise défensivement une URL dangereuse', () => {
    const dangerous = persistedWith({
      days: [{
        ...consultationTravel.days[0],
        steps: [{
          ...consultationTravel.days[0]!.steps[0],
          links: [{ id: 'bad-link', label: 'Itinéraire compromis', href: 'javascript:alert(1)' }],
        }],
      }],
    })
    render(<ConsultationHarness travel={dangerous} initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByText('Lien refusé · Itinéraire compromis')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Itinéraire compromis/ })).not.toBeInTheDocument()
  })

  it('désactive les services externes hors connexion sans bloquer le contenu local', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} online={false} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeInTheDocument()
    expect(screen.getAllByText('Indisponible hors connexion').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /itinéraire vers le marché/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Document local · Ouvrir Confirmation/ }).length).toBeGreaterThan(0)
  })
})

describe('variantes contextuelles', () => {
  it('affiche uniquement les modes réellement disponibles en plus du standard', () => {
    render(<ConsultationHarness />)

    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Économe en marche' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pluie' })).toBeInTheDocument()
  })

  it('change de variante sans perdre la journée ni son étape courante', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pluie' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeInTheDocument()
    expect(screen.getByText('Accueil couvert')).toBeInTheDocument()
    expect(screen.getByText('Passage au marché')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Économe en marche' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeInTheDocument()
    expect(screen.getByText('Marché sans détour')).toBeInTheDocument()
  })

  it('explique l’absence d’adaptation pour la journée sans masquer le standard', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-island' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pluie' }))

    expect(screen.getByText(/Aucune adaptation « Pluie »/)).toBeInTheDocument()
    expect(screen.getByText('Prendre le bateau')).toBeInTheDocument()
  })

  it('gère un voyage qui ne propose aucune variante', () => {
    render(<ConsultationHarness travel={persistedWith({ variants: [] })} />)

    expect(screen.getByText(/Aucune variante n’est proposée/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pluie' })).not.toBeInTheDocument()
  })
})
