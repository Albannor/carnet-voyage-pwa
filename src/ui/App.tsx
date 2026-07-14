import { useState, type ChangeEvent } from 'react'
import {
  importTravelPackage,
  type ValidatedTravelPackage,
} from '../import/importTravelPackage'
import type { ImportIssue } from '../import/errors'

const principles = [
  {
    title: 'Local',
    description: 'Les voyages resteront enregistrés sur votre appareil.',
  },
  {
    title: 'Disponible',
    description: 'Les informations essentielles seront consultables hors ligne.',
  },
  {
    title: 'Cohérent',
    description: 'Chaque voyage bénéficiera de la même interface claire et familière.',
  },
]

type ImportUiState =
  | { status: 'idle' }
  | { status: 'processing'; fileName: string }
  | { status: 'success'; fileName: string; result: ValidatedTravelPackage }
  | { status: 'error'; fileName: string; errors: readonly ImportIssue[] }

export function App() {
  const [importState, setImportState] = useState<ImportUiState>({ status: 'idle' })

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    setImportState({ status: 'processing', fileName: file.name })
    const result = await importTravelPackage(file)

    setImportState(
      result.ok
        ? { status: 'success', fileName: file.name, result: result.package }
        : { status: 'error', fileName: file.name, errors: result.errors },
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu
      </a>

      <header className="hero">
        <div className="brand-mark" aria-hidden="true">
          CV
        </div>
        <p className="eyebrow">Votre bibliothèque personnelle</p>
        <h1>Carnet de voyage</h1>
        <p className="intro">
          Importez un paquet de voyage contrôlé avant de conserver et consulter
          ses informations essentielles hors ligne.
        </p>
      </header>

      <main id="contenu-principal" tabIndex={-1}>
        <section className="foundation" aria-labelledby="foundation-title">
          <p className="section-label">Import sécurisé</p>
          <h2 id="foundation-title">Vérifier un paquet de voyage</h2>
          <p className="foundation-copy">
            Sélectionnez une archive ZIP structurée. Le paquet et ses ressources
            sont vérifiés entièrement avant que le voyage soit disponible en
            mémoire. Rien n’est encore enregistré sur cet appareil.
          </p>

          <section className="import-panel" aria-labelledby="import-title">
            <div>
              <h3 id="import-title">Sélectionner un paquet</h3>
              <p id="package-format-help" className="format-help">
                Format accepté : archive ZIP de 25 Mio maximum contenant
                manifest.json et voyage.json.
              </p>
            </div>

            <label className="file-picker" htmlFor="travel-package">
              Choisir un fichier ZIP
            </label>
            <input
              id="travel-package"
              className="file-input"
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              aria-describedby="package-format-help"
              disabled={importState.status === 'processing'}
              onChange={(event) => void handleFileSelection(event)}
            />

            {importState.status === 'processing' && (
              <p className="import-status" role="status" aria-live="polite">
                Vérification de « {importState.fileName} » en cours…
              </p>
            )}

            {importState.status === 'success' && (
              <section
                className="import-result import-success"
                aria-labelledby="import-success-title"
                role="status"
              >
                <p className="result-label">Paquet validé</p>
                <h3 id="import-success-title">{importState.result.travel.title}</h3>
                <p>
                  {importState.result.travel.destination.label} ·{' '}
                  {importState.result.travel.period.start} au{' '}
                  {importState.result.travel.period.end}
                </p>
                <p className="result-note">
                  Voyage disponible en mémoire uniquement. Vous pouvez choisir un
                  autre paquet.
                </p>
              </section>
            )}

            {importState.status === 'error' && (
              <section
                className="import-result import-errors"
                aria-labelledby="import-error-title"
                role="alert"
              >
                <p className="result-label">Import refusé</p>
                <h3 id="import-error-title">
                  Le paquet « {importState.fileName} » n’est pas valide
                </h3>
                <ul>
                  {importState.errors.map((error, index) => (
                    <li key={`${error.code}-${error.file ?? ''}-${error.field ?? ''}-${index}`}>
                      <strong>{error.message}</strong>
                      {(error.file || error.field) && (
                        <span>
                          {[error.file, error.field].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <span>{error.hint}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>

          <ul className="principles" aria-label="Principes du carnet">
            {principles.map((principle) => (
              <li key={principle.title}>
                <strong>{principle.title}</strong>
                <span>{principle.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer>
        <p>Aucun compte requis. Vos voyages resteront sous votre contrôle.</p>
      </footer>
    </div>
  )
}
