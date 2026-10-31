/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
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
import type { TravelPlace, TravelStep } from '../../domain/voyage/model'
import type { PersistedTravel } from '../../persistence/model'
import { TravelConsultation, type TravelView } from './TravelConsultation'
import {
  consultationTravel,
  fixedClock,
  persistedConsultationTravel,
} from './testFixtures'

const consultationStyles = readFileSync(
  resolve(process.cwd(), 'src/ui/styles.css'),
  'utf8',
).replace(/\s+/g, ' ')

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => `blob:test-${blob.type}`),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function ConsultationHarness({
  travel = persistedConsultationTravel,
  initialView = { kind: 'summary' },
  instant = '2026-07-15T10:00:00Z',
  onBack = vi.fn(),
  online = true,
  onCopyAddress = vi.fn().mockResolvedValue(true),
  onOpenDocument = vi.fn(),
  onLoadIllustrationResource = vi.fn().mockResolvedValue({
    ok: true,
    resource: {
      travelId: consultationTravel.id,
      resourceId: 'image-test',
      path: 'assets/test.png',
      mediaType: 'image/png',
      size: 8,
      sha256: 'a'.repeat(64),
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    },
  }),
  personalState = { checkedItemKeys: [], note: '' },
  onSetChecklistItemChecked = vi.fn().mockResolvedValue({ ok: true }),
  onSaveNote = vi.fn().mockResolvedValue({ ok: true }),
}: {
  travel?: PersistedTravel
  initialView?: TravelView
  instant?: string
  onBack?: () => void
  online?: boolean
  onCopyAddress?: (address: string, label: string) => Promise<boolean>
  onOpenDocument?: (document: typeof consultationTravel.documents[number]) => void
  onLoadIllustrationResource?: (
    travelId: string,
    resourceId: string,
  ) => Promise<
    | { ok: true; resource: {
      travelId: string
      resourceId: string
      path: string
      mediaType: 'image/png'
      size: number
      sha256: string
      bytes: Uint8Array
    } }
    | { ok: false; message: string }
  >
  personalState?: { checkedItemKeys: readonly string[]; note: string }
  onSetChecklistItemChecked?: (
    checklistId: string,
    itemId: string,
    checked: boolean,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  onSaveNote?: (text: string) => Promise<{ ok: true } | { ok: false; message: string }>
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
      onLoadIllustrationResource={onLoadIllustrationResource}
      onListLocalResourceIds={vi.fn().mockResolvedValue([])}
      userPieces={[]}
      onAddUserPiece={vi.fn()}
      onRenameUserPiece={vi.fn()}
      onDeleteUserPiece={vi.fn()}
      onOpenUserPiece={vi.fn()}
      onLoadUserPieceFile={vi.fn()}
      personalState={personalState}
      noteSaveDelayMs={10}
      onSetChecklistItemChecked={onSetChecklistItemChecked}
      onSaveNote={onSaveNote}
    />
  )
}

function persistedWith(overrides: Partial<typeof consultationTravel>): PersistedTravel {
  return {
    ...persistedConsultationTravel,
    travel: { ...consultationTravel, ...overrides },
  }
}

function openSection(name: 'Aperçu' | 'Programme' | 'Pièces' | 'Préparation') {
  fireEvent.click(screen.getByRole('button', { name }))
}

function openDay(title: string) {
  const selector = screen.getByRole('navigation', { name: 'Choisir une journée' })
  fireEvent.click(within(selector).getByRole('button', { name: new RegExp(title) }))
}

const illustratedTravel = persistedWith({
  coverIllustrationId: 'illustration-cover',
  illustrations: [
    {
      id: 'illustration-cover',
      resourceId: 'image-cover',
      alt: 'Vue panoramique du port',
      caption: 'Le port au début du séjour.',
      provenance: {
        type: 'licensed',
        creator: 'Camille Exemple',
        sourceUrl: 'https://example.org/source',
        licenseCode: 'CC-BY-4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        modified: true,
      },
    },
    {
      id: 'illustration-day',
      resourceId: 'image-day',
      alt: 'Quai pendant la journée',
      provenance: { type: 'user-provided', credit: 'Collection personnelle' },
    },
    {
      id: 'illustration-step',
      resourceId: 'image-step',
      alt: 'Promenade illustrée',
      caption: 'Repère de l’étape.',
      provenance: {
        type: 'ai-generated',
        provider: 'Fournisseur de test',
        generatedAt: '2026-06-01',
      },
    },
  ],
  days: consultationTravel.days.map((day, dayIndex) => ({
    ...day,
    illustrationIds: dayIndex === 0 ? ['illustration-day'] : [],
    steps: day.steps.map((step, stepIndex) => ({
      ...step,
      illustrationIds:
        dayIndex === 0 && stepIndex === 0 ? ['illustration-step'] : [],
    })),
  })),
})

function withStep(
  persistedTravel: PersistedTravel,
  stepId: string,
  update: (step: TravelStep) => TravelStep,
) {
  return {
    ...persistedTravel,
    travel: {
      ...persistedTravel.travel,
      days: persistedTravel.travel.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) => step.id === stepId ? update(step) : step),
      })),
    },
  }
}

function withPlace(
  persistedTravel: PersistedTravel,
  placeId: string,
  update: (place: TravelPlace) => TravelPlace,
) {
  return {
    ...persistedTravel,
    travel: {
      ...persistedTravel.travel,
      places: persistedTravel.travel.places.map(
        (place) => place.id === placeId ? update(place) : place,
      ),
    },
  }
}

describe('navigation structurée du voyage', () => {
  it('expose exactement les quatre sections principales', () => {
    render(<ConsultationHarness />)

    const navigation = screen.getByRole('navigation', { name: 'Sections du voyage' })
    expect(within(navigation).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Aperçu',
      'Programme',
      'Pièces',
      'Préparation',
    ])
    expect(within(navigation).getByRole('button', { name: 'Aperçu' }))
      .toHaveAttribute('aria-current', 'page')
  })

  it('limite la vue d’ensemble aux informations essentielles et aux réservations datées', () => {
    render(<ConsultationHarness />)

    expect(screen.getByRole('heading', { level: 1, name: consultationTravel.title })).toBeInTheDocument()
    expect(screen.getByText(consultationTravel.destination.label)).toBeInTheDocument()
    expect(screen.getByText(consultationTravel.summary)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'À retenir' })).toBeInTheDocument()
    expect(screen.getByText('Réservation Maison du port')).toBeInTheDocument()
    expect(screen.queryByText('Quai du Carénage')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ouvrir le document/ })).not.toBeInTheDocument()
  })

  it('n’affiche aucun détail technique vide pour un ancien voyage minimal', () => {
    render(<ConsultationHarness travel={persistedWith({
      accommodations: [],
      places: [],
      days: [],
      variants: [],
      documents: [],
      reservations: [],
      checklists: [],
      illustrations: [],
      coverIllustrationId: undefined,
    })} />)

    expect(screen.getByText(consultationTravel.summary)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'À retenir' })).not.toBeInTheDocument()
  })

  it('ouvre chaque section et annonce la section active', () => {
    render(<ConsultationHarness />)

    openSection('Programme')
    expect(screen.getByText(/Section active : Programme — Autour du port/)).toBeInTheDocument()
    openSection('Pièces')
    expect(screen.getByText('Section active : Pièces')).toBeInTheDocument()
    openSection('Préparation')
    expect(screen.getByText('Section active : Préparation')).toBeInTheDocument()
    openSection('Aperçu')
    expect(screen.getByText('Section active : Aperçu')).toBeInTheDocument()
  })

  it('revient à la bibliothèque avec un contrôle explicite', () => {
    const onBack = vi.fn()
    render(<ConsultationHarness onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('programme et navigation entre journées', () => {
  it('affiche un sélecteur compact avec date, titre et état actif', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const selector = screen.getByRole('navigation', { name: 'Choisir une journée' })
    expect(within(selector).getAllByRole('button')).toHaveLength(3)
    expect(within(selector).getByRole('button', { name: /Arrivée au port/ }))
      .toHaveAttribute('aria-current', 'page')
    expect(within(selector).getByText('Journée active')).toBeInTheDocument()
  })

  it('change de journée avec le sélecteur et les boutons précédent et suivant', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    openDay('Cap sur l’île')
    expect(screen.getByRole('heading', { level: 2, name: 'Cap sur l’île' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Journée précédente : Autour du port/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Journée suivante : Cap sur l’île/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Cap sur l’île' })).toBeInTheDocument()
  })

  it('permet le changement de journée au clavier avec les flèches', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const activeDay = screen.getByRole('button', { name: /Arrivée au port/ })
    activeDay.focus()
    fireEvent.keyDown(activeDay, { key: 'ArrowRight' })

    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
  })

  it('rend les étapes dans l’ordre normalisé avec une colonne horaire stable', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const timeline = screen.getByRole('heading', { name: 'Déroulé' }).parentElement
    expect(within(timeline as HTMLElement).getAllByRole('heading', { level: 4 })
      .map((heading) => heading.textContent)).toEqual([
      'Passage au marché',
      'Installation',
      'Pause libre',
    ])
    expect(within(timeline as HTMLElement).getByText('Sans horaire')).toBeInTheDocument()
    expect(consultationStyles).toMatch(/\.timeline-step \{[^}]*min-width: 0;[^}]*padding: 0 0 0\.875rem 2\.75rem;/)
    expect(consultationStyles).toMatch(/\.step-content \{[^}]*min-width: 0;/)
  })

  it('affiche proprement une journée sans étape et un voyage sans journée', () => {
    const { rerender } = render(
      <ConsultationHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />,
    )
    expect(screen.getByText('Aucune étape n’est renseignée pour cette journée.')).toBeInTheDocument()

    rerender(
      <ConsultationHarness
        key="empty-travel"
        travel={persistedWith({ days: [] })}
        initialView={{ kind: 'today' }}
      />,
    )
    expect(screen.getByText('Ce voyage ne contient aucune journée.')).toBeInTheDocument()
  })

  it('gère Aujourd’hui avant, pendant et après le voyage sans inventer de programme', () => {
    const { rerender } = render(
      <ConsultationHarness initialView={{ kind: 'today' }} instant="2026-07-15T10:00:00Z" />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()

    rerender(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-06-01T10:00:00Z" />)
    expect(screen.getByText(/n’a pas encore commencé/)).toBeInTheDocument()

    rerender(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-08-01T10:00:00Z" />)
    expect(screen.getByText(/est terminé/)).toBeInTheDocument()
  })

  it('explique une date du séjour sans journée correspondante', () => {
    render(<ConsultationHarness initialView={{ kind: 'today' }} instant="2026-07-17T10:00:00Z" />)
    expect(screen.getByText(/Aucune journée n’est prévue/)).toBeInTheDocument()
  })
})

describe('déroulé, actions et compléments', () => {
  it('ne répète pas la fiche complète de l’hôtel dans le programme', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.queryByRole('button', { name: /Voir l’hébergement associé à Installation/ }))
      .not.toBeInTheDocument()
    expect(screen.queryByText('Quai du Carénage')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Maison du port' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’étape Installation' }))
    expect(screen.getByRole('button', { name: /Voir l’hébergement associé à Installation/ }))
      .toBeInTheDocument()
    expect(screen.queryByText('Quai du Carénage')).not.toBeInTheDocument()
  })

  it('mène depuis l’étape à la fiche de son hébergement dans Pièces', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      render(<ConsultationHarness initialView={{ kind: 'step', stepId: 'step-check-in' }} />)

      fireEvent.click(screen.getByRole('button', { name: /Voir l’hébergement associé à Installation/ }))
      expect(screen.getByText('Section active : Pièces')).toBeInTheDocument()
      const card = screen.getByRole('article', { name: 'Maison du port' })
      expect(card).toHaveFocus()
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' })
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(card)
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('résume les pièces de l’étape dans la frise sans les recopier', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const installation = screen.getByRole('heading', { name: 'Installation' })
      .closest('.step-content') as HTMLElement
    expect(within(installation).queryByRole('button', { name: /Ouvrir le document/ }))
      .not.toBeInTheDocument()
    expect(within(installation).queryByText('PORT-2026')).not.toBeInTheDocument()
    expect(within(installation).queryByText('Quai du Carénage')).not.toBeInTheDocument()
    const hint = within(installation).getByRole('button', {
      name: 'Voir le détail de l’étape Installation : 2 pièces',
    })
    expect(hint).toHaveTextContent('2 pièces')
    const pause = screen.getByRole('heading', { name: 'Pause libre' })
      .closest('.step-content') as HTMLElement
    expect(pause.querySelector('.step-details-hint')).not.toBeInTheDocument()

    fireEvent.click(hint)
    expect(screen.getByText('Section active : Étape — Installation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Réservation Maison du port' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Voir la fiche Confirmation d’hébergement/ }))
      .toBeInTheDocument()
  })

  it('conserve le libellé éditorial du lien et son contexte dans aria-label', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const itinerary = screen.getByRole('link', {
      name: /Ouvrir l’itinéraire vers le marché pour Passage au marché — service externe/,
    })
    expect(itinerary).toHaveTextContent('Ouvrir l’itinéraire vers le marché')
    expect(itinerary).toHaveAttribute('href', 'https://example.com/route/market')
  })

  it('neutralise les URL dangereuses et les actions externes hors connexion', () => {
    const unsafeTravel = persistedWith({
      days: consultationTravel.days.map((day) => ({
        ...day,
        steps: day.steps.map((step) => step.id === 'step-market' ? {
          ...step,
          links: [{ id: 'unsafe', label: 'Itinéraire', href: 'javascript:alert(1)' }],
        } : step),
      })),
    })
    const { rerender } = render(
      <ConsultationHarness
        travel={unsafeTravel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )
    expect(screen.getByLabelText(/Itinéraire pour Passage au marché — lien externe refusé/))
      .toHaveAttribute('aria-disabled', 'true')

    rerender(
      <ConsultationHarness
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        online={false}
      />,
    )
    expect(screen.getByLabelText(/Ouvrir l’itinéraire vers le marché.*indisponible hors connexion/))
      .toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('heading', { name: 'Passage au marché' })).toBeInTheDocument()
  })

  it('regroupe toutes les variantes de la journée dans Plans B', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const disclosure = screen.getByText('Plans B')
    fireEvent.click(disclosure)
    expect(screen.getByText('Accueil couvert')).toBeInTheDocument()
    expect(screen.getByText('Marché sans détour')).toBeInTheDocument()
    expect(screen.getByText('Pluie')).toBeInTheDocument()
    expect(screen.getByText('Économe en marche')).toBeInTheDocument()
  })

  it('n’affiche aucun bloc Plans B lorsqu’une journée ne possède pas de variante', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)
    expect(screen.queryByText('Plans B')).not.toBeInTheDocument()
  })
})

describe('liens pratiques au fil du programme', () => {
  it('ne crée aucun emplacement d’action pour une étape sans lien ni image', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const step = screen.getByRole('heading', { name: 'Pause libre' })
      .closest('.step-content') as HTMLElement
    expect(step.querySelector('.contextual-link-list')).not.toBeInTheDocument()
    expect(within(step).queryByRole('link')).not.toBeInTheDocument()
  })

  it('affiche un lien compact dans une étape non illustrée', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const step = screen.getByRole('heading', { name: 'Passage au marché' })
      .closest('.step-content') as HTMLElement
    const link = within(step).getByRole('link', {
      name: /Ouvrir l’itinéraire vers le marché.*service externe/,
    })
    expect(link).toHaveClass('contextual-link')
    expect(link).not.toHaveClass('document-button')
    expect(step.querySelector('.contextual-link-list')).toContainElement(link)
  })

  it('rend la première illustration cliquable avec l’unique lien HTTPS de l’étape', async () => {
    render(
      <ConsultationHarness
        travel={illustratedTravel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const imageLink = screen.getByRole('link', {
      name: /Ouvrir l’itinéraire vers le marché pour Passage au marché.*service externe/,
    })
    expect(imageLink).toHaveAttribute('href', 'https://example.com/route/market')
    expect(imageLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(await within(imageLink).findByAltText('Promenade illustrée')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Liens pratiques pour Passage au marché' }))
      .not.toBeInTheDocument()
  })

  it('utilise l’unique lien du lieu si l’étape illustrée ne porte aucun lien', async () => {
    const placeLink = {
      id: 'market-official',
      label: 'Consulter le site du marché',
      href: 'https://example.com/market',
    }
    const travelWithoutStepLink = withStep(
      withPlace(illustratedTravel, 'place-market', (place) => ({
        ...place,
        links: [placeLink],
      })),
      'step-market',
      (step) => ({ ...step, links: [] }),
    )
    render(
      <ConsultationHarness
        travel={travelWithoutStepLink}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const image = await screen.findByAltText('Promenade illustrée')
    expect(image.closest('a')).toHaveAttribute('href', 'https://example.com/market')
    expect(image.closest('a')).toHaveAccessibleName(
      /Consulter le site du marché pour Passage au marché/,
    )
  })

  it('donne la priorité à l’unique lien explicite de l’étape sur celui du lieu', async () => {
    const travelWithPlaceLink = withPlace(illustratedTravel, 'place-market', (place) => ({
      ...place,
      links: [{
        id: 'market-place-link',
        label: 'Informations du marché',
        href: 'https://example.com/market/info',
      }],
    }))
    render(
      <ConsultationHarness
        travel={travelWithPlaceLink}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const image = await screen.findByAltText('Promenade illustrée')
    expect(image.closest('a')).toHaveAttribute('href', 'https://example.com/route/market')
    expect(screen.getByRole('link', { name: /Informations du marché.*service externe/ }))
      .toHaveAttribute('href', 'https://example.com/market/info')
  })

  it('laisse l’image non interactive lorsque plusieurs liens sont possibles', async () => {
    const travelWithSeveralLinks = withStep(
      illustratedTravel,
      'step-market',
      (step) => ({
        ...step,
        links: [
          ...step.links,
          {
            id: 'market-hours',
            label: 'Consulter les horaires exceptionnellement très détaillés du marché central',
            href: 'https://example.com/market/hours',
          },
        ],
      }),
    )
    render(
      <ConsultationHarness
        travel={travelWithSeveralLinks}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const image = await screen.findByAltText('Promenade illustrée')
    const step = screen.getByRole('heading', { name: 'Passage au marché' })
      .closest('.step-content') as HTMLElement
    expect(image.closest('a')).toBeNull()
    expect(within(step).getAllByRole('link')).toHaveLength(2)
    expect(within(step).getByText(/horaires exceptionnellement très détaillés/))
      .toBeInTheDocument()
  })

  it('n’utilise jamais les URL de provenance comme action pratique', async () => {
    const provenanceSource = 'https://photos.example.com/source'
    const travel = withStep(
      {
        ...illustratedTravel,
        travel: {
          ...illustratedTravel.travel,
          illustrations: illustratedTravel.travel.illustrations.map((illustration) => (
            illustration.id === 'illustration-step'
              ? {
                  ...illustration,
                  provenance: {
                    type: 'licensed' as const,
                    creator: 'Auteur de test',
                    sourceUrl: provenanceSource,
                    licenseCode: 'CC-BY-4.0',
                    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
                    modified: false,
                  },
                }
              : illustration
          )),
        },
      },
      'step-market',
      (step) => ({ ...step, links: [] }),
    )
    render(
      <ConsultationHarness
        travel={travel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const image = await screen.findByAltText('Promenade illustrée')
    expect(image.closest('a')).toBeNull()
    expect(document.querySelector(`a[href="${provenanceSource}"]`)).toBeNull()
  })

  it('conserve l’image locale mais désactive son lien hors connexion', async () => {
    render(
      <ConsultationHarness
        travel={illustratedTravel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        online={false}
      />,
    )

    const image = await screen.findByAltText('Promenade illustrée')
    expect(image.closest('a')).toBeNull()
    expect(screen.getByText(
      'Ouvrir l’itinéraire vers le marché · indisponible hors connexion',
    )).toHaveAttribute('role', 'status')
    expect(screen.getByText('Prévoir les courses utiles pour la journée.')).toBeInTheDocument()
  })

  it('reste utilisable au clavier avec un nom accessible explicite', async () => {
    render(
      <ConsultationHarness
        travel={illustratedTravel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )

    const imageLink = screen.getByRole('link', {
      name: /Ouvrir l’itinéraire vers le marché pour Passage au marché/,
    })
    imageLink.focus()
    expect(imageLink).toHaveFocus()
    expect(await within(imageLink).findByAltText('Promenade illustrée'))
      .toHaveAttribute('alt', 'Promenade illustrée')
  })

  it('alimente le programme et les lieux de Pièces depuis les mêmes liens de lieu', () => {
    const link = {
      id: 'market-information',
      label: 'Informations pratiques du marché central',
      href: 'https://example.com/market/information',
    }
    const travel = withPlace(persistedConsultationTravel, 'place-market', (place) => ({
      ...place,
      links: [link],
    }))
    render(
      <ConsultationHarness
        travel={travel}
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
      />,
    )
    expect(screen.getByRole('link', { name: /Informations pratiques du marché central.*Passage au marché/ }))
      .toHaveAttribute('href', link.href)

    openSection('Pièces')
    expect(screen.getByRole('link', { name: /Informations pratiques du marché central.*Marché central/ }))
      .toHaveAttribute('href', link.href)
  })

  it('utilise des liens éditoriaux compacts sans réintroduire de grands boutons', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const link = screen.getByRole('link', {
      name: /Ouvrir l’itinéraire vers le marché.*service externe/,
    })
    expect(link.tagName).toBe('A')
    expect(link).toHaveClass('contextual-link')
    expect(consultationStyles).toMatch(
      /\.contextual-link \{[^}]*display: inline-flex;[^}]*background: transparent;/,
    )
    expect(consultationStyles).toMatch(
      /\.contextual-link-list,[^{]*\.practical-link-list \{[^}]*flex-wrap: wrap;/,
    )
  })
})

describe('repères du dossier dans Pièces', () => {
  it('affiche une seule fiche complète par hébergement', () => {
    render(<ConsultationHarness initialView={{ kind: 'pieces' }} />)

    expect(screen.getAllByRole('heading', { name: 'Maison du port' })).toHaveLength(1)
    expect(screen.getAllByRole('heading', { name: 'Escale insulaire' })).toHaveLength(1)
    expect(screen.getAllByText('Quai du Carénage')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Lieux et transports utiles' })).toBeInTheDocument()
  })

  it('relie l’hébergement à ses pièces par identifiants explicites, sans les recopier', () => {
    render(<ConsultationHarness initialView={{ kind: 'pieces' }} />)

    const accommodation = screen.getByRole('article', { name: 'Maison du port' })
    expect(within(accommodation).getByRole('button', {
      name: /^Voir la fiche Réservation Maison du port, pièce de Maison du port/,
    })).toBeInTheDocument()
    expect(within(accommodation).getByRole('button', {
      name: /^Voir la fiche Confirmation d’hébergement, pièce de Maison du port/,
    })).toBeInTheDocument()
    expect(screen.queryByText('PORT-2026')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ouvrir le document/ })).not.toBeInTheDocument()
    expect(document.querySelector('.reservation-card')).not.toBeInTheDocument()
  })

  it('copie l’adresse depuis la fiche centralisée uniquement', () => {
    const onCopyAddress = vi.fn().mockResolvedValue(true)
    render(<ConsultationHarness initialView={{ kind: 'pieces' }} onCopyAddress={onCopyAddress} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copier l’adresse de Maison du port' }))
    expect(onCopyAddress).toHaveBeenCalledWith('Quai du Carénage', 'Vieux-Port')
  })

  it('ouvre un document local de l’hébergement même hors connexion', () => {
    const onOpenDocument = vi.fn()
    render(
      <ConsultationHarness
        initialView={{ kind: 'pieces' }}
        online={false}
        onOpenDocument={onOpenDocument}
      />,
    )

    const accommodation = screen.getByRole('article', { name: 'Maison du port' })
    expect(within(accommodation).getAllByLabelText(/indisponible hors connexion/).length)
      .toBeGreaterThan(0)
    fireEvent.click(within(accommodation).getByRole('button', {
      name: /^Voir la fiche Confirmation d’hébergement, pièce de Maison du port/,
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le PDF Confirmation d’hébergement' }))
    expect(onOpenDocument).toHaveBeenCalledWith(consultationTravel.documents[0])
  })
})

describe('préparation et états personnels', () => {
  it('organise les checklists selon leur cible sans les mélanger à la synthèse', () => {
    render(<ConsultationHarness />)
    expect(screen.queryByText('Avant le départ')).not.toBeInTheDocument()

    openSection('Préparation')
    expect(screen.getByRole('heading', { name: 'Pour le voyage' })).toBeInTheDocument()
    expect(screen.getByText('Avant le départ')).toBeInTheDocument()
    expect(screen.getByText('Pour l’arrivée')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Passage au marché' })).toBeInTheDocument()
    expect(screen.getByText('Au marché')).toBeInTheDocument()
  })

  it('conserve les checklists de journée et d’étape dans leur contexte du programme', () => {
    render(
      <ConsultationHarness
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        personalState={{ checkedItemKeys: ['checklist-step/item-bag'], note: '' }}
      />,
    )

    expect(screen.getByText('Pour l’arrivée')).toBeInTheDocument()
    const marketStep = screen.getByRole('heading', { name: 'Passage au marché' })
      .closest('.step-content') as HTMLElement
    expect(within(marketStep).queryByText('Au marché')).not.toBeInTheDocument()
    expect(within(marketStep).getByRole('button', {
      name: 'Voir le détail de l’étape Passage au marché : checklist, 1 sur 1 cochés',
    })).toHaveTextContent('Checklist 1/1')
    expect(screen.queryByText('Avant le départ')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’étape Passage au marché' }))
    expect(screen.getByRole('heading', { name: 'Checklist de l’étape' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Prendre un sac' })).toBeChecked()
  })

  it('persiste une case cochée et n’annonce la réussite qu’après l’écriture', async () => {
    let resolveSave: ((value: { ok: true }) => void) | undefined
    const onSetChecklistItemChecked = vi.fn(() => new Promise<{ ok: true }>((resolve) => {
      resolveSave = resolve
    }))
    render(
      <ConsultationHarness
        initialView={{ kind: 'preparation' }}
        onSetChecklistItemChecked={onSetChecklistItemChecked}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Prendre les pièces d’identité' })
    fireEvent.click(checkbox)
    expect(screen.getByText('Enregistrement local…')).toBeInTheDocument()
    expect(screen.queryByText('Enregistré localement')).not.toBeInTheDocument()
    await act(async () => resolveSave?.({ ok: true }))
    expect(await screen.findByText('Enregistré localement')).toBeInTheDocument()
  })

  it('charge un état coché et rétablit la valeur après un échec', async () => {
    const onSetChecklistItemChecked = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Écriture impossible.',
    })
    render(
      <ConsultationHarness
        initialView={{ kind: 'preparation' }}
        personalState={{
          checkedItemKeys: ['checklist-travel/item-passport'],
          note: '',
        }}
        onSetChecklistItemChecked={onSetChecklistItemChecked}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Prendre les pièces d’identité' })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec de l’enregistrement')
    expect(checkbox).toBeChecked()
  })

  it('charge et enregistre la note uniquement dans Préparation', async () => {
    vi.useFakeTimers()
    const onSaveNote = vi.fn().mockResolvedValue({ ok: true })
    render(
      <ConsultationHarness
        initialView={{ kind: 'preparation' }}
        personalState={{ checkedItemKeys: [], note: 'Note locale existante' }}
        onSaveNote={onSaveNote}
      />,
    )

    const note = screen.getByRole('textbox', { name: 'Note générale du voyage' })
    expect(note).toHaveValue('Note locale existante')
    fireEvent.change(note, { target: { value: '<b>Texte brut</b>' } })
    expect(screen.getByText('Modification en cours…')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(10)
      await Promise.resolve()
    })
    expect(onSaveNote).toHaveBeenCalledWith('<b>Texte brut</b>')
    expect(note).toHaveValue('<b>Texte brut</b>')
    vi.useRealTimers()
  })

  it('n’affiche aucune section de checklist lorsqu’il n’y en a pas', () => {
    render(
      <ConsultationHarness
        travel={persistedWith({ checklists: [] })}
        initialView={{ kind: 'preparation' }}
      />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/Aucune préparation structurée/)).toBeInTheDocument()
  })
})

describe('illustrations et robustesse responsive', () => {
  it('affiche la couverture sur la vue d’ensemble et les images dans leur contexte', async () => {
    render(<ConsultationHarness travel={illustratedTravel} />)
    expect(await screen.findByAltText('Vue panoramique du port')).toBeInTheDocument()
    expect(screen.getByText('Le port au début du séjour.')).toBeInTheDocument()

    openSection('Programme')
    openDay('Arrivée au port')
    expect(await screen.findByAltText('Quai pendant la journée')).toBeInTheDocument()
    expect(await screen.findByAltText('Promenade illustrée')).toHaveAttribute('loading', 'lazy')
  })

  it('centralise les crédits photographiques dans Pièces', () => {
    render(<ConsultationHarness travel={illustratedTravel} initialView={{ kind: 'pieces' }} />)

    expect(screen.getByRole('heading', { name: 'Crédits photographiques' })).toBeInTheDocument()
    expect(screen.getByText('Auteur : Camille Exemple')).toBeInTheDocument()
    expect(screen.getByText(/Photographie personnelle/)).toBeInTheDocument()
    expect(screen.getByText(/Image générée par IA/)).toBeInTheDocument()
  })

  it('révoque les URL Blob au démontage et au changement de section', async () => {
    const { unmount } = render(<ConsultationHarness travel={illustratedTravel} />)
    await screen.findByAltText('Vue panoramique du port')
    unmount()

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-image/png')
  })

  it('ne crée aucun espace d’image pour les versions 1.0.0 à 1.2.0 sans illustration', () => {
    render(<ConsultationHarness travel={persistedWith({
      contentVersion: '1.0.0',
      illustrations: [],
      coverIllustrationId: undefined,
    })} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('Crédits photographiques')).not.toBeInTheDocument()
  })

  it('protège le rendu mobile contre les débordements et maintient des cibles tactiles', () => {
    expect(consultationStyles).toMatch(
      /\.travel-bottom-nav \{[^}]*position: fixed;[^}]*env\(safe-area-inset-bottom\)/,
    )
    expect(consultationStyles).toMatch(/\.travel-bottom-nav li \{[^}]*min-width: 0;[^}]*flex: 1 1 0;/)
    expect(consultationStyles).toMatch(/\.travel-nav-button \{[^}]*min-height: 3\.5rem;/)
    expect(consultationStyles).toMatch(
      /\.travel-workspace \{[^}]*padding-bottom: calc\(6rem \+ env\(safe-area-inset-bottom\)\);/,
    )
    expect(consultationStyles).toMatch(
      /\.day-selector \{[^}]*max-width: 100%;[^}]*overflow-x: auto;/,
    )
    expect(consultationStyles).toMatch(
      /\.program-layout,[^{]*\.program-main,[^{]*\.day-sidebar \{[^}]*min-width: 0;/,
    )
    expect(consultationStyles).toContain('min-height: 2.75rem;')
    expect(consultationStyles).toContain('@media (width >= 62rem)')
  })

  it('conserve la protection de mise en page des réservations longues', () => {
    expect(consultationStyles).toMatch(
      /\.reservation-card \{[^}]*min-width: 0;[^}]*grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(consultationStyles).toMatch(
      /\.reservation-metadata dd \{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/,
    )
  })

  it('n’utilise jamais le HTML importé ni une injection active', async () => {
    const source = await import('./TravelConsultation.tsx?raw')
    expect(source.default).not.toContain('Guide_Madrid')
    expect(source.default).not.toContain('innerHTML')
    expect(source.default).not.toContain('<iframe')
    expect(source.default).not.toContain('eval(')
  })
})

describe('associations sans répétition', () => {
  it('ne reproduit pas deux fois le même lien de lieu sur le programme', () => {
    const duplicateLink = consultationTravel.places[1].links[0] ?? {
      id: 'place-market-route',
      label: 'Itinéraire marché',
      href: 'https://example.com/route/market',
    }
    const travel = persistedWith({
      places: consultationTravel.places.map((place) => place.id === 'place-market'
        ? { ...place, links: [duplicateLink] }
        : place),
    })
    render(<ConsultationHarness travel={travel} initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getAllByText('Ouvrir l’itinéraire vers le marché')).toHaveLength(1)
  })

  it('gère plusieurs hébergements sans déduire les associations par libellé', () => {
    render(<ConsultationHarness initialView={{ kind: 'pieces' }} />)
    const cards = screen.getAllByText('Hébergement')
    expect(cards).toHaveLength(2)
    expect(screen.getByText('Jetée principale')).toBeInTheDocument()
    const islandCard = screen.getByRole('article', { name: 'Escale insulaire' })
    expect(within(islandCard).queryByText('Réservation Maison du port')).not.toBeInTheDocument()
  })

  it('supporte titres et descriptions longs sans largeur dépendante du contenu', () => {
    const longTitle = 'Une journée dont le titre reste lisible même lorsqu’il contient beaucoup de mots'
    const longTravel = persistedWith({
      days: consultationTravel.days.map((day, index) => index === 0
        ? { ...day, title: longTitle, summary: 'Résumé '.repeat(40) }
        : day),
    })
    render(<ConsultationHarness travel={longTravel} initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByRole('heading', { name: longTitle })).toBeInTheDocument()
    expect(consultationStyles).toMatch(/\.day-selector ol \{[^}]*width: max-content;/)
    expect(consultationStyles).toMatch(/\.day-title \{[^}]*overflow-wrap: anywhere;/)
  })

  it('laisse tous les contrôles principaux accessibles au clavier', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)
    const controls = [
      screen.getByRole('button', { name: 'Retour à la bibliothèque' }),
      screen.getByRole('button', { name: 'Aperçu' }),
      screen.getByRole('button', { name: 'Programme' }),
      screen.getByRole('button', { name: /Arrivée au port/ }),
      screen.getByRole('button', { name: /Journée suivante/ }),
    ]
    controls.forEach((control) => {
      control.focus()
      expect(control).toHaveFocus()
    })
  })

  it('n’affiche les réservations à confirmer que dans Préparation', () => {
    const travel = persistedWith({
      reservations: consultationTravel.reservations.map((reservation) => ({
        ...reservation,
        status: 'À confirmer auprès du prestataire',
      })),
    })
    render(<ConsultationHarness travel={travel} />)
    expect(screen.queryByRole('heading', { name: 'À confirmer' })).not.toBeInTheDocument()

    openSection('Préparation')
    expect(screen.getByRole('heading', { name: 'À confirmer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Réservation Maison du port' })).toBeInTheDocument()
  })

  it('affiche une réservation concise sans document ni lien', () => {
    const travel = persistedWith({
      reservations: [{
        ...consultationTravel.reservations[0],
        links: [],
        documentIds: [],
      }],
      documents: [],
      days: consultationTravel.days.map((day) => ({
        ...day,
        documentIds: [],
        steps: day.steps.map((step) => ({
          ...step,
          documentIds: [],
        })),
      })),
    })
    render(
      <ConsultationHarness
        travel={travel}
        initialView={{ kind: 'piece', pieceKind: 'reservation', pieceId: 'reservation-stay' }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Réservation Maison du port' })).toBeInTheDocument()
    const card = document.querySelector('.piece-reservation') as HTMLElement
    expect(within(card).getByText('Confirmée')).toBeInTheDocument()
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
    expect(within(card).queryByRole('link')).not.toBeInTheDocument()
  })

  it('attend la ressource locale sans masquer le texte essentiel', async () => {
    let resolveResource: ((value: {
      ok: true
      resource: {
        travelId: string
        resourceId: string
        path: string
        mediaType: 'image/png'
        size: number
        sha256: string
        bytes: Uint8Array
      }
    }) => void) | undefined
    const onLoadIllustrationResource = vi.fn(() => new Promise<{
      ok: true
      resource: {
        travelId: string
        resourceId: string
        path: string
        mediaType: 'image/png'
        size: number
        sha256: string
        bytes: Uint8Array
      }
    }>((resolve) => {
      resolveResource = resolve
    }))
    render(
      <ConsultationHarness
        travel={illustratedTravel}
        onLoadIllustrationResource={onLoadIllustrationResource}
      />,
    )
    expect(screen.getByText(consultationTravel.summary)).toBeInTheDocument()
    expect(screen.getByText('Chargement de l’illustration locale…')).toBeInTheDocument()

    await act(async () => resolveResource?.({
      ok: true,
      resource: {
        travelId: consultationTravel.id,
        resourceId: 'image-cover',
        path: 'assets/cover.png',
        mediaType: 'image/png',
        size: 4,
        sha256: 'a'.repeat(64),
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      },
    }))
    await waitFor(() => expect(screen.getByAltText('Vue panoramique du port')).toBeInTheDocument())
  })
})

describe('aperçu du voyage', () => {
  it('superpose le retour à la couverture puis le place dans la barre des autres sections', () => {
    const onBack = vi.fn()
    render(<ConsultationHarness onBack={onBack} />)

    expect(screen.getByRole('heading', { level: 1, name: consultationTravel.title }))
      .toHaveClass('travel-title')
    openSection('Pièces')
    expect(screen.getByRole('heading', { level: 1, name: consultationTravel.title }))
      .toHaveClass('travel-topbar-title')
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('présente la journée du jour pendant le voyage', () => {
    render(<ConsultationHarness />)

    const card = screen.getByRole('region', { name: 'Aujourd’hui' })
    expect(card).toHaveTextContent('Mercredi 15 juillet · Autour du port')
    fireEvent.click(within(card).getByRole('button', { name: 'Voir la journée' }))
    expect(screen.getByText('Section active : Programme d’aujourd’hui')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Autour du port' })).toBeInTheDocument()
  })

  it('annonce le départ avant le voyage et mène à la première journée', () => {
    render(<ConsultationHarness instant="2026-07-01T10:00:00Z" />)

    const card = screen.getByRole('region', { name: 'Départ dans 13 jours' })
    expect(card).toHaveTextContent('Mardi 14 juillet · Arrivée au port')
    fireEvent.click(within(card).getByRole('button', { name: 'Voir le programme' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Arrivée au port' })).toBeInTheDocument()
  })

  it('reste utile après le voyage', () => {
    render(<ConsultationHarness instant="2026-08-01T10:00:00Z" />)

    const card = screen.getByRole('region', { name: 'Voyage terminé' })
    expect(within(card).getByRole('button', { name: 'Revoir le programme' })).toBeInTheDocument()
  })

  it('liste les journées et ouvre celle choisie', () => {
    render(<ConsultationHarness />)

    const days = screen.getByRole('region', { name: 'Les 3 journées' })
    const buttons = within(days).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveTextContent('Arrivée au port')
    fireEvent.click(within(days).getByRole('button', { name: /Cap sur l’île/ }))
    expect(screen.getByRole('heading', { level: 2, name: 'Cap sur l’île' })).toBeInTheDocument()
  })

  it('ancre l’hébergement du moment et confirme la copie de son adresse', async () => {
    const onCopyAddress = vi.fn().mockResolvedValue(true)
    render(<ConsultationHarness onCopyAddress={onCopyAddress} />)

    const stay = screen.getByRole('region', { name: 'Maison du port' })
    expect(stay).toHaveTextContent('Vieux-Port')
    expect(stay).not.toHaveTextContent('Quai du Carénage')
    fireEvent.click(within(stay).getByRole('button', { name: 'Copier l’adresse de Maison du port' }))

    expect(onCopyAddress).toHaveBeenCalledWith('Quai du Carénage', 'Vieux-Port')
    expect(await within(stay).findByRole('status')).toHaveTextContent('Adresse copiée')
  })

  it('n’annonce pas de copie lorsque le presse-papiers refuse', async () => {
    const onCopyAddress = vi.fn().mockResolvedValue(false)
    render(<ConsultationHarness initialView={{ kind: 'pieces' }} onCopyAddress={onCopyAddress} />)

    const button = screen.getByRole('button', { name: 'Copier l’adresse de Maison du port' })
    fireEvent.click(button)

    expect(await screen.findByText('Copie impossible sur cet appareil')).toBeInTheDocument()
    expect(button).toHaveTextContent('Copier l’adresse')
    expect(screen.queryByText('Adresse copiée')).not.toBeInTheDocument()
  })
})

describe('navigation du bas', () => {
  it('associe une icône et un libellé à chaque section et marque la section active', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const navigation = screen.getByRole('navigation', { name: 'Sections du voyage' })
    for (const button of within(navigation).getAllByRole('button')) {
      expect(button.querySelector('svg')).toBeInTheDocument()
    }
    expect(within(navigation).getByRole('button', { name: 'Programme' }))
      .toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('button', { name: 'Aperçu' }))
      .not.toHaveAttribute('aria-current')
  })

  it('ramène le haut de la section à l’écran lors d’un changement de section', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      render(<ConsultationHarness />)
      expect(scrollIntoView).not.toHaveBeenCalled()

      openSection('Préparation')
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })
})

describe('quatre types d’actions', () => {
  it('distingue lien externe, copie, document local et réservation', () => {
    const { unmount } = render(
      <ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />,
    )

    const link = screen.getAllByRole('link', { name: /service externe/ })[0]
    expect(link).toHaveClass('contextual-link')
    expect(link.querySelector('svg')).toBeInTheDocument()
    expect(link).not.toHaveTextContent('↗')
    expect(screen.getByRole('button', { name: 'Copier l’adresse de Maison du port' }))
      .toHaveClass('copy-button')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’étape Installation' }))
    expect(screen.getByRole('heading', { name: 'Réservation Maison du port' })
      .closest('.reservation-card')).toBeInTheDocument()
    unmount()

    render(
      <ConsultationHarness
        initialView={{ kind: 'piece', pieceKind: 'reservation', pieceId: 'reservation-stay' }}
      />,
    )
    const documentButton = screen.getByRole('button', {
      name: /Ouvrir le document Confirmation d’hébergement/,
    })
    expect(documentButton).toHaveClass('document-button')
    expect(documentButton.querySelector('svg')).toBeInTheDocument()

    expect(consultationStyles).toMatch(/\.contextual-link \{[^}]*text-decoration: underline;/)
    expect(consultationStyles).toMatch(/\.copy-button \{[^}]*border: 0\.09375rem solid var\(--color-line-strong\);[^}]*background: var\(--color-paper\);/)
    expect(consultationStyles).toMatch(/\.document-button \{[^}]*color: var\(--color-sage\);[^}]*background: var\(--color-sage-soft\);/)
    expect(consultationStyles).toMatch(/\.reservation-card \{[^}]*border: 0\.0625rem solid var\(--color-sun\);[^}]*background: var\(--color-sun-soft\);/)
  })
})

describe('journée : repères et progression', () => {
  it('propose des jours compacts avec jour de semaine, numéro et repère du jour', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    const selector = screen.getByRole('navigation', { name: 'Choisir une journée' })
    const today = within(selector).getByRole('button', { name: /Autour du port/ })
    expect(today).toHaveAccessibleName(/\(aujourd’hui\)/)
    expect(today.querySelector('.day-choice-today')).toBeInTheDocument()
    expect(within(selector).getByRole('button', { name: /Arrivée au port/ }))
      .toHaveTextContent(/mar\.?14/i)
    expect(screen.getByText('Jour 1 sur 3')).toBeInTheDocument()
  })

  it('signale la journée du jour et l’hébergement de départ sans répéter l’adresse', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)

    expect(screen.getByText('Aujourd’hui sur place')).toBeInTheDocument()
    expect(screen.getByText('Mercredi 15 juillet 2026')).toBeInTheDocument()
    expect(screen.getByText(/Départ :/)).toHaveTextContent('Départ : Maison du port')
    expect(screen.queryByText('Quai du Carénage')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copier l’adresse de Maison du port' }))
      .toBeInTheDocument()
  })

  it('présente l’hébergement comme arrivée le jour de son début', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.getByText(/Hébergement :/)).toHaveTextContent('Hébergement : Maison du port')
    expect(screen.queryByText('Aujourd’hui sur place')).not.toBeInTheDocument()
  })

  it('met en avant la prochaine étape le jour même', () => {
    render(
      <ConsultationHarness
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        instant="2026-07-14T10:00:00Z"
      />,
    )

    const market = screen.getByRole('heading', { name: 'Passage au marché' })
      .closest('.timeline-step') as HTMLElement
    const checkIn = screen.getByRole('heading', { name: 'Installation' })
      .closest('.timeline-step') as HTMLElement
    expect(market).toHaveClass('timeline-step-done')
    expect(within(market).getByText('Étape passée')).toBeInTheDocument()
    expect(checkIn).toHaveClass('timeline-step-next')
    expect(within(checkIn).getByText('Prochaine étape')).toBeInTheDocument()
  })

  it('annonce une étape en cours', () => {
    render(
      <ConsultationHarness
        initialView={{ kind: 'day', dayId: 'day-arrival' }}
        instant="2026-07-14T07:30:00Z"
      />,
    )

    const market = screen.getByRole('heading', { name: 'Passage au marché' })
      .closest('.timeline-step') as HTMLElement
    expect(within(market).getByText('En cours')).toBeInTheDocument()
    expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
  })

  it('actualise la progression lorsque l’heure avance', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      let now = new Date('2026-07-14T06:50:00Z')
      const clock = { now: () => now }
      render(
        <TravelConsultation
          persistedTravel={persistedConsultationTravel}
          view={{ kind: 'day', dayId: 'day-arrival' }}
          clock={clock}
          online
          personalState={{ checkedItemKeys: [], note: '' }}
          onNavigate={vi.fn()}
          onBackToLibrary={vi.fn()}
          onCopyAddress={vi.fn().mockResolvedValue(true)}
          onOpenDocument={vi.fn()}
          onLoadIllustrationResource={vi.fn().mockResolvedValue({ ok: false, message: '' })}
          onListLocalResourceIds={vi.fn().mockResolvedValue([])}
          userPieces={[]}
          onAddUserPiece={vi.fn()}
          onRenameUserPiece={vi.fn()}
          onDeleteUserPiece={vi.fn()}
          onOpenUserPiece={vi.fn()}
          onLoadUserPieceFile={vi.fn()}
          onSetChecklistItemChecked={vi.fn()}
          onSaveNote={vi.fn()}
        />,
      )
      expect(screen.getByText('Prochaine étape')).toBeInTheDocument()

      now = new Date('2026-07-14T07:10:00Z')
      act(() => vi.advanceTimersByTime(60_000))
      expect(screen.getByText('En cours')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ne marque aucune progression un autre jour que celui du voyage en cours', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

    expect(screen.queryByText('Prochaine étape')).not.toBeInTheDocument()
    expect(screen.queryByText('Étape passée')).not.toBeInTheDocument()
  })

  it('relie chaque étape et la journée à leur plan B regroupé', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-arrival' }} />)

      const plans = screen.getByRole('region', { name: 'Plans B' })
      expect(within(plans).getByText('Remplace ou complète : Passage au marché')).toBeInTheDocument()
      expect(within(plans).getByText('Pour toute la journée')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Voir le plan B prévu pour Passage au marché' }))
      const marketPlan = within(plans).getByText('Marché sans détour').closest('li')
      expect(marketPlan).toHaveFocus()
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })

      fireEvent.click(screen.getByRole('button', { name: 'Voir le plan B prévu pour cette journée' }))
      expect(within(plans).getByText('Accueil couvert').closest('li')).toHaveFocus()
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('ne propose aucun lien vers un plan B absent', () => {
    render(<ConsultationHarness initialView={{ kind: 'day', dayId: 'day-harbour' }} />)
    expect(screen.queryByRole('button', { name: /plan B/ })).not.toBeInTheDocument()
  })
})
