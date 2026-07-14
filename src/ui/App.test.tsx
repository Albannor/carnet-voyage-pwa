import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('présente le socle de Carnet de voyage', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Carnet de voyage' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/permettra de conserver vos voyages/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Aller au contenu' }),
    ).toHaveAttribute('href', '#contenu-principal')
  })
})
