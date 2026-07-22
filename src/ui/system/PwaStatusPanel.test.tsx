import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PwaStatusPanel } from './PwaStatusPanel'

afterEach(cleanup)

describe('informations système PWA', () => {
  it('explique que les contenus locaux restent consultables hors connexion', () => {
    render(
      <PwaStatusPanel
        online={false}
        pwaStatus="idle"
        onDismissPwaStatus={vi.fn()}
        onApplyUpdate={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Hors connexion')
    expect(screen.getByRole('status')).toHaveTextContent(
      'contenus enregistrés restent consultables',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'services externes sont indisponibles',
    )
  })

  it('annonce la disponibilité hors ligne et permet de fermer le message', () => {
    const onDismissPwaStatus = vi.fn()
    render(
      <PwaStatusPanel
        online
        pwaStatus="offline-ready"
        onDismissPwaStatus={onDismissPwaStatus}
        onApplyUpdate={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Prêt hors ligne')
    fireEvent.click(screen.getByRole('button', { name: 'Compris' }))
    expect(onDismissPwaStatus).toHaveBeenCalledOnce()
  })

  it('laisse l’utilisateur choisir le moment du rechargement', () => {
    const onApplyUpdate = vi.fn()
    const onDismissPwaStatus = vi.fn()
    render(
      <PwaStatusPanel
        online
        pwaStatus="update-available"
        onDismissPwaStatus={onDismissPwaStatus}
        onApplyUpdate={onApplyUpdate}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Mise à jour disponible',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'données personnelles resteront sur cet appareil',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Recharger maintenant' }),
    )
    expect(onApplyUpdate).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
    expect(onDismissPwaStatus).toHaveBeenCalledOnce()
  })
})
