import type { ChangeEvent, RefObject } from 'react'
import type { TravelCoverLoadResult } from '../../application/loadTravelCover'
import type { ImportIssue } from '../../import/errors'
import type { TravelLibraryEntry } from '../../persistence/model'
import type { PersistenceIssue } from '../../persistence/repository'
import {
  ChevronRightIcon,
  DeviceIcon,
  OfflineReadyIcon,
  ShieldIcon,
  UploadIcon,
} from '../icons'
import { arrangeLibrary, formatTravelDates, type TravelTiming } from './libraryArrangement'
import { CompactTravelItem, FeaturedTravelCard } from './TravelLibraryCard'

export type ImportUiState =
  | { status: 'idle' }
  | { status: 'processing'; fileName: string }
  | { status: 'success'; fileName: string; entry: TravelLibraryEntry }
  | {
      status: 'error'
      fileName: string
      title: string
      errors: readonly (ImportIssue | PersistenceIssue)[]
    }

export type LibraryUiState =
  | { status: 'loading' }
  | { status: 'ready'; entries: readonly TravelLibraryEntry[] }
  | { status: 'error'; error: PersistenceIssue }

export type ActionUiState =
  | { status: 'idle' }
  | { status: 'processing'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; error: PersistenceIssue }

const featuredLabels: Record<TravelTiming, string> = {
  ongoing: 'Voyage en cours',
  upcoming: 'Prochain voyage',
  past: 'Dernier voyage',
}

function issueContext(error: ImportIssue | PersistenceIssue) {
  if ('kind' in error) {
    return [error.file, error.field].filter(Boolean).join(' · ')
  }
  return [error.travelId, error.resourceId].filter(Boolean).join(' · ')
}

interface ImportPickerProps {
  readonly variant: 'primary' | 'secondary'
  readonly disabled: boolean
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void
}

function ImportPicker({ variant, disabled, inputRef, onFileSelection }: ImportPickerProps) {
  return (
    <div className="import-picker">
      <input
        ref={inputRef}
        id="travel-package"
        className="file-input"
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        aria-describedby="package-format-help"
        disabled={disabled}
        onChange={onFileSelection}
      />
      <label className={`file-picker file-picker-${variant}`} htmlFor="travel-package">
        <UploadIcon size={22} />
        Choisir un fichier ZIP
      </label>
      <details className="format-details">
        <summary>
          <ChevronRightIcon size={16} className="format-details-chevron" />
          Format accepté
        </summary>
        <p id="package-format-help">
          Un fichier ZIP de 25 Mio maximum, préparé avec la Fabrique de carnets
          de voyage. Si ce voyage est déjà dans votre carnet, il n’est pas
          importé une seconde fois : rien n’est remplacé.
        </p>
      </details>
    </div>
  )
}

function ImportFeedback({ importState }: { readonly importState: ImportUiState }) {
  if (importState.status === 'processing') {
    return (
      <p className="notice" role="status" aria-live="polite">
        Validation et enregistrement de « {importState.fileName} » en cours…
      </p>
    )
  }
  if (importState.status === 'success') {
    return (
      <section
        className="notice notice-success"
        aria-labelledby="import-success-title"
        role="status"
      >
        <p className="notice-label">Voyage enregistré</p>
        <h2 id="import-success-title" className="notice-title">{importState.entry.title}</h2>
        <p>
          {importState.entry.destination} ·{' '}
          {formatTravelDates(importState.entry.startDate, importState.entry.endDate)}
        </p>
        <p className="notice-note">
          Il est enregistré sur cet appareil et reste lisible sans réseau.
        </p>
      </section>
    )
  }
  if (importState.status === 'error') {
    return (
      <section
        className="notice notice-error"
        aria-labelledby="import-error-title"
        role="alert"
      >
        <p className="notice-label">Import non enregistré</p>
        <h2 id="import-error-title" className="notice-title">{importState.title}</h2>
        <ul className="import-error-list">
          {importState.errors.map((error, index) => {
            const context = issueContext(error)
            return (
              <li key={`${error.code}-${context}-${index}`}>
                <strong>{error.message}</strong>
                {context && <span>{context}</span>}
                <span>{error.hint}</span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }
  return null
}

function ActionFeedback({ actionState }: { readonly actionState: ActionUiState }) {
  if (actionState.status === 'processing') {
    return (
      <p className="notice" role="status" aria-live="polite">
        {actionState.message}
      </p>
    )
  }
  if (actionState.status === 'success') {
    return (
      <p className="notice notice-success" role="status">
        {actionState.message}
      </p>
    )
  }
  if (actionState.status === 'error') {
    return (
      <p className="notice notice-error" role="alert">
        <strong>{actionState.error.message}</strong> {actionState.error.hint}
      </p>
    )
  }
  return null
}

const steps = [
  { title: 'Préparez le voyage', detail: 'avec la Fabrique de carnets de voyage' },
  { title: 'Récupérez le fichier ZIP', detail: 'sur cet appareil' },
  { title: 'Importez-le ici', detail: 'il reste lisible sans réseau' },
]

function EmptyLibrary({ picker }: { readonly picker: ImportPickerProps }) {
  return (
    <>
      <section className="empty-library" aria-labelledby="empty-library-title">
        <img
          className="empty-library-logo"
          src={`${import.meta.env.BASE_URL}icons/carnet.svg`}
          alt=""
          width={104}
          height={104}
        />
        <h2 id="empty-library-title" className="display-title">
          Votre carnet est vide
        </h2>
        <p className="empty-library-intro">
          Importez un voyage préparé avec la Fabrique : il reste lisible sur cet
          appareil, même sans réseau.
        </p>
        <ImportPicker {...picker} />
      </section>
      <section className="paper-card how-it-works" aria-labelledby="how-it-works-title">
        <h2 id="how-it-works-title" className="section-label">Comment ça marche</h2>
        <ol className="step-list">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="step-number" aria-hidden="true">{index + 1}</span>
              <span>
                <strong>{step.title}</strong>{' '}
                <span>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

interface LibraryViewProps {
  readonly libraryState: LibraryUiState
  readonly importState: ImportUiState
  readonly actionState: ActionUiState
  readonly today: string
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  readonly onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onOpen: (travelId: string) => void
  readonly onDelete: (entry: TravelLibraryEntry) => void
  readonly onLoadCover: (travelId: string) => Promise<TravelCoverLoadResult>
}

export function LibraryView({
  libraryState,
  importState,
  actionState,
  today,
  fileInputRef,
  onFileSelection,
  onOpen,
  onDelete,
  onLoadCover,
}: LibraryViewProps) {
  const pickerDisabled = importState.status === 'processing' || libraryState.status !== 'ready'
  const picker = (variant: ImportPickerProps['variant']): ImportPickerProps => ({
    variant,
    disabled: pickerDisabled,
    inputRef: fileInputRef,
    onFileSelection,
  })
  const arrangement = libraryState.status === 'ready' && libraryState.entries.length > 0
    ? arrangeLibrary(libraryState.entries, today)
    : undefined
  const featured = arrangement?.featured
  const others = arrangement?.others ?? []

  return (
    <div className="library-view">
      <ImportFeedback importState={importState} />
      <ActionFeedback actionState={actionState} />

      {libraryState.status === 'loading' && (
        <p className="notice" role="status" aria-live="polite">
          Chargement de votre carnet…
        </p>
      )}
      {libraryState.status === 'error' && (
        <div className="notice notice-error" role="alert">
          <strong>{libraryState.error.message}</strong> {libraryState.error.hint}
        </div>
      )}
      {libraryState.status === 'ready' && libraryState.entries.length === 0 && (
        <EmptyLibrary picker={picker('primary')} />
      )}
      {arrangement && (
        <>
          {featured && (
            <section aria-labelledby="featured-travel-title">
              <h2 id="featured-travel-title" className="section-label">
                {featuredLabels[featured.timing]}
              </h2>
              <FeaturedTravelCard
                entry={featured.entry}
                timing={featured.timing}
                onOpen={onOpen}
                onDelete={onDelete}
                onLoadCover={onLoadCover}
              />
            </section>
          )}
          {others.length > 0 && (
            <section aria-labelledby="other-travels-title">
              <h2 id="other-travels-title" className="section-label section-label-muted">
                Autres voyages · {others.length}
              </h2>
              <ul className="travel-rows">
                {others.map(({ entry }) => (
                  <CompactTravelItem
                    key={entry.travelId}
                    entry={entry}
                    onOpen={onOpen}
                    onDelete={onDelete}
                    onLoadCover={onLoadCover}
                  />
                ))}
              </ul>
            </section>
          )}
          <section className="import-section" aria-labelledby="import-title">
            <h2 id="import-title" className="visually-hidden">Importer un voyage</h2>
            <ImportPicker {...picker('secondary')} />
          </section>
        </>
      )}
    </div>
  )
}

const trustItems = [
  { icon: DeviceIcon, label: 'Sur l’appareil', detail: 'vos voyages sont enregistrés ici' },
  { icon: OfflineReadyIcon, label: 'Hors connexion', detail: 'ils restent lisibles sans réseau' },
  { icon: ShieldIcon, label: 'Sans compte', detail: 'aucune inscription requise' },
]

export function TrustRow() {
  return (
    <ul className="trust-row" aria-label="Principes du carnet">
      {trustItems.map(({ icon: ItemIcon, label, detail }) => (
        <li key={label}>
          <ItemIcon size={22} className="icon-sage" />
          <span>
            {label}
            <span className="visually-hidden"> : {detail}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
