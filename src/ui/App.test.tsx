import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const { importTravelPackageMock } = vi.hoisted(() => ({
  importTravelPackageMock: vi.fn(),
}))

vi.mock('../import/importTravelPackage', () => ({
  importTravelPackage: importTravelPackageMock,
}))

const selectedFile = new File(['zip'], 'mon-voyage.zip', {
  type: 'application/zip',
})

beforeEach(() => {
  importTravelPackageMock.mockReset()
})

describe('App', () => {
  it('présente un sélecteur ZIP accessible', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Carnet de voyage' }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Choisir un fichier ZIP'),
    ).toHaveAttribute('accept', expect.stringContaining('.zip'))
    expect(
      screen.getByRole('link', { name: 'Aller au contenu' }),
    ).toHaveAttribute('href', '#contenu-principal')
    expect(screen.getByText(/rien n’est encore enregistré/i)).toBeInTheDocument()
  })

  it('annonce le traitement du paquet sélectionné', () => {
    importTravelPackageMock.mockReturnValue(new Promise(() => undefined))
    render(<App />)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Vérification de « mon-voyage.zip » en cours',
    )
    expect(screen.getByLabelText('Choisir un fichier ZIP')).toBeDisabled()
  })

  it('affiche le résumé minimal d’un voyage entièrement validé', async () => {
    importTravelPackageMock.mockResolvedValue({
      ok: true,
      package: {
        travel: {
          title: 'Escapade test',
          destination: { label: 'Destination test' },
          period: { start: '2026-10-01', end: '2026-10-03' },
        },
      },
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(
      await screen.findByRole('heading', { name: 'Escapade test' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/destination test · 2026-10-01/i)).toBeInTheDocument()
    expect(screen.getByText(/en mémoire uniquement/i)).toBeInTheDocument()
  })

  it('affiche les erreurs compréhensibles avec leur contexte', async () => {
    importTravelPackageMock.mockResolvedValue({
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
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Choisir un fichier ZIP'), {
      target: { files: [selectedFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une ressource déclarée est absente.',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('assets/cover.png')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ajoutez la ressource au paquet.',
    )
  })
})
