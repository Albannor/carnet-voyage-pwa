/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TravelLibraryEntry } from '../../persistence/model'
import { TravelLibraryCard } from './TravelLibraryCard'

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

describe('TravelLibraryCard', () => {
  it('affiche une couverture 1.3.0 locale et révoque son URL Blob', async () => {
    const onLoadCover = vi.fn().mockResolvedValue({
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
    })
    const { unmount } = render(
      <TravelLibraryCard
        entry={entry}
        onLoadCover={onLoadCover}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(await screen.findByRole('img', { name: 'Vue panoramique de Rome.' }))
      .toHaveAttribute('src', 'blob:rome-cover')
    expect(onLoadCover).toHaveBeenCalledWith(entry.travelId)
    expect(URL.createObjectURL).toHaveBeenCalled()

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rome-cover')
  })

  it('garde le titre long dans une colonne flexible et raccourcit les boutons visibles', async () => {
    render(
      <TravelLibraryCard
        entry={entry}
        onLoadCover={vi.fn().mockResolvedValue({ status: 'absent' })}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: entry.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Ouvrir ${entry.title}` }))
      .toHaveTextContent(/^Ouvrir$/)
    expect(screen.getByRole('button', { name: `Supprimer ${entry.title}` }))
      .toHaveTextContent(/^Supprimer$/)
    expect(screen.getByText('Rome')).toBeInTheDocument()
    expect(screen.getByText('2027-01-08')).toBeInTheDocument()
  })

  it('affiche un fallback compact pour un ancien voyage 1.0.0 sans couverture', async () => {
    const oldEntry = {
      ...entry,
      sourceTravelVersion: '1.0.0',
      title: 'Ancien voyage',
    }
    render(
      <TravelLibraryCard
        entry={oldEntry}
        onLoadCover={vi.fn().mockResolvedValue({ status: 'absent' })}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(await screen.findByRole('img', {
      name: 'Aucune couverture disponible pour Ancien voyage',
    })).toHaveClass('travel-card-cover-fallback')
    expect(screen.queryByRole('img', { name: /Vue/ })).not.toBeInTheDocument()
  })

  it('définit une grille robuste sur ordinateur et une pile sans débordement sur mobile', () => {
    expect(styles).toMatch(
      /\.travel-card \{[^}]*min-width: 0;[^}]*grid-template-columns: minmax\(0, 1fr\);/,
    )
    expect(styles).toMatch(
      /\.travel-card-content \{[^}]*min-width: 0;/,
    )
    expect(styles).toMatch(
      /@media \(min-width: 48rem\) \{[^]*?\.travel-card \{[^}]*grid-template-columns: minmax\(8rem, 11rem\) minmax\(0, 1fr\) minmax\(7rem, 9rem\);/,
    )
    expect(styles).toMatch(
      /\.travel-actions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    )
    expect(styles).toMatch(
      /\.travel-card-cover img \{[^}]*width: 100%;[^}]*object-fit: cover;/,
    )
  })
})
