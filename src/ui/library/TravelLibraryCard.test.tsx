/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TravelLibraryEntry } from '../../persistence/model'
import { CompactTravelItem, FeaturedTravelCard } from './TravelLibraryCard'

const styles = readFileSync(
  resolve(process.cwd(), 'src/ui/styles.css'),
  'utf8',
).replace(/\s+/g, ' ')

const entry: TravelLibraryEntry = {
  travelId: 'rome-profession-foi-2027-test',
  packageId: 'rome-profession-foi-2027-test',
  title: 'Rome en famille - profession de foi de Théophile avec un titre volontairement très long',
  destination: 'Rome',
  startDate: '2027-01-08',
  endDate: '2027-01-11',
  sourcePackageVersion: '1.0.0',
  sourceTravelVersion: '1.3.0',
  importedAt: '2026-07-16T12:00:00.000Z',
  storageSchemaVersion: 1,
  internalModelVersion: 4,
}

const readyCover = {
  status: 'ready',
  illustration: {
    id: 'illustration-cover',
    resourceId: 'image-cover-skyline',
    alt: 'Vue panoramique de Rome.',
    provenance: { type: 'user-provided' },
  },
  resource: {
    travelId: entry.travelId,
    resourceId: 'image-cover-skyline',
    path: 'assets/cover-skyline.webp',
    mediaType: 'image/webp',
    size: 4,
    sha256: 'a'.repeat(64),
    bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  },
}

function renderFeatured(overrides: Partial<Parameters<typeof FeaturedTravelCard>[0]> = {}) {
  return render(
    <FeaturedTravelCard
      entry={entry}
      timing="upcoming"
      onLoadCover={vi.fn().mockResolvedValue({ status: 'absent' })}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:rome-cover'),
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

describe('carte « Prochain voyage »', () => {
  it('affiche une couverture 1.3.0 locale et révoque son URL Blob', async () => {
    const onLoadCover = vi.fn().mockResolvedValue(readyCover)
    const { unmount } = renderFeatured({ onLoadCover })

    expect(await screen.findByRole('img', { name: 'Vue panoramique de Rome.' }))
      .toHaveAttribute('src', 'blob:rome-cover')
    expect(onLoadCover).toHaveBeenCalledWith(entry.travelId)
    expect(URL.createObjectURL).toHaveBeenCalled()

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rome-cover')
  })

  it('présente titre, destination, dates, durée et état avec un texte', () => {
    const onOpen = vi.fn()
    renderFeatured({ onOpen })

    expect(screen.getByRole('heading', { level: 3, name: entry.title })).toBeInTheDocument()
    expect(screen.getByText('Rome')).toBeInTheDocument()
    expect(screen.getByText(/8\s?–\s?11 janv\. 2027 · 4 jours/)).toBeInTheDocument()
    expect(screen.getByText('À venir')).toBeInTheDocument()

    const open = screen.getByRole('button', { name: `Ouvrir ${entry.title}` })
    expect(open).toHaveTextContent(/^Ouvrir le voyage$/)
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith(entry.travelId)
  })

  it('affiche une illustration de repli pour un ancien voyage 1.0.0 sans couverture', async () => {
    renderFeatured({ entry: { ...entry, sourceTravelVersion: '1.0.0', title: 'Ancien voyage' } })

    expect(await screen.findByRole('img', {
      name: 'Aucune couverture disponible pour Ancien voyage',
    })).toHaveClass('travel-cover-fallback')
    expect(screen.queryByRole('img', { name: /Vue/ })).not.toBeInTheDocument()
  })

  it('range la suppression dans « Plus d’options », loin du bouton d’ouverture', () => {
    renderFeatured()

    expect(screen.queryByRole('button', { name: `Supprimer ${entry.title}` }))
      .not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: `Plus d’options pour ${entry.title}` })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: `Supprimer ${entry.title}` }))
      .toHaveTextContent('Supprimer ce voyage')
  })

  it('demande une confirmation explicite qui rappelle la perte des notes et checklists', () => {
    const onDelete = vi.fn()
    renderFeatured({ onDelete })

    fireEvent.click(screen.getByRole('button', { name: `Plus d’options pour ${entry.title}` }))
    fireEvent.click(screen.getByRole('button', { name: `Supprimer ${entry.title}` }))

    const confirmation = screen.getByRole('group', { name: `Supprimer « ${entry.title} » ?` })
    expect(confirmation).toHaveFocus()
    expect(confirmation).toHaveTextContent(/notes et checklists seront aussi supprimées/)
    expect(confirmation).toHaveTextContent(/définitive/)
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(onDelete).toHaveBeenCalledWith(entry)
  })

  it('annule la suppression et rend le focus au bouton d’options', () => {
    const onDelete = vi.fn()
    renderFeatured({ onDelete })
    const toggle = screen.getByRole('button', { name: `Plus d’options pour ${entry.title}` })

    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: `Supprimer ${entry.title}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })

  it('ferme le menu avec Échap', () => {
    renderFeatured()
    const toggle = screen.getByRole('button', { name: `Plus d’options pour ${entry.title}` })

    fireEvent.click(toggle)
    fireEvent.keyDown(screen.getByRole('button', { name: `Supprimer ${entry.title}` }), {
      key: 'Escape',
    })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: `Supprimer ${entry.title}` }))
      .not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})

describe('voyage de la liste compacte', () => {
  it('ouvre le voyage depuis une ligne qui décrit destination et dates', () => {
    const onOpen = vi.fn()
    render(
      <ul>
        <CompactTravelItem
          entry={entry}
          onLoadCover={vi.fn().mockResolvedValue({ status: 'absent' })}
          onOpen={onOpen}
          onDelete={vi.fn()}
        />
      </ul>,
    )

    const open = screen.getByRole('button', { name: `Ouvrir ${entry.title}` })
    expect(open).toHaveAccessibleDescription(/^Rome · 8\s?–\s?11 janv\. 2027$/)
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith(entry.travelId)
  })

  it('propose aussi la suppression confirmée depuis son menu', () => {
    const onDelete = vi.fn()
    render(
      <ul>
        <CompactTravelItem
          entry={entry}
          onLoadCover={vi.fn().mockResolvedValue({ status: 'absent' })}
          onOpen={vi.fn()}
          onDelete={onDelete}
        />
      </ul>,
    )

    fireEvent.click(screen.getByRole('button', { name: `Plus d’options pour ${entry.title}` }))
    fireEvent.click(screen.getByRole('button', { name: `Supprimer ${entry.title}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(onDelete).toHaveBeenCalledWith(entry)
  })
})

describe('styles de la bibliothèque', () => {
  it('évite tout débordement horizontal des titres longs sur mobile', () => {
    expect(styles).toMatch(/\.next-travel \{[^}]*min-width: 0;/)
    expect(styles).toMatch(/\.card-title \{[^}]*overflow-wrap: anywhere;/)
    expect(styles).toMatch(/\.travel-row-open \{[^}]*min-width: 0;/)
    expect(styles).toMatch(/\.travel-row-text \{[^}]*min-width: 0;/)
    expect(styles).toMatch(/\.travel-row-title, \.travel-row-meta \{[^}]*overflow-wrap: anywhere;/)
    expect(styles).toMatch(/\.travel-cover img, \.travel-thumbnail img \{[^}]*width: 100%;[^}]*object-fit: cover;/)
  })

  it('garde des cibles tactiles d’au moins 44 px et un focus visible', () => {
    expect(styles).toMatch(/--tap-target: 2\.75rem;/)
    expect(styles).toMatch(/\.round-button \{[^}]*width: var\(--tap-target\);[^}]*height: var\(--tap-target\);/)
    expect(styles).toMatch(/\.menu-action \{[^}]*min-height: var\(--tap-target\);/)
    expect(styles).toMatch(/:focus-visible \{[^}]*outline: var\(--focus-ring\);/)
    expect(styles).toMatch(/\.file-input:focus-visible \+ \.file-picker \{[^}]*outline: var\(--focus-ring\);/)
  })

  it('réserve l’ombre à la carte « Prochain voyage »', () => {
    const shadows = styles.match(/box-shadow: var\(--shadow-featured\)/g) ?? []
    expect(shadows).toHaveLength(1)
    expect(styles).toMatch(/\.next-travel \{[^}]*box-shadow: var\(--shadow-featured\);/)
  })
})
