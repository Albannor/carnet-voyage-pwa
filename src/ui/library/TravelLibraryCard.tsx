import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { TravelCoverLoadResult } from '../../application/loadTravelCover'
import type { TravelLibraryEntry } from '../../persistence/model'
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  MoreIcon,
  TrashIcon,
} from '../icons'
import { formatTravelDates, travelDurationLabel } from '../travelDates'
import type { TravelTiming } from './libraryArrangement'

type LoadCover = (travelId: string) => Promise<TravelCoverLoadResult>

interface TravelEntryProps {
  readonly entry: TravelLibraryEntry
  readonly onOpen: (travelId: string) => void
  readonly onDelete: (entry: TravelLibraryEntry) => void
  readonly onLoadCover: LoadCover
}

type CoverState =
  | { readonly key: string; readonly status: 'absent' | 'error' }
  | {
      readonly key: string
      readonly status: 'ready'
      readonly source: string
      readonly alt: string
    }

function useTravelCover(travelId: string, onLoadCover: LoadCover) {
  const [coverState, setCoverState] = useState<CoverState>()

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined

    void onLoadCover(travelId).then((result) => {
      if (!active) return
      if (result.status !== 'ready') {
        setCoverState({ key: travelId, status: result.status })
        return
      }

      try {
        objectUrl = URL.createObjectURL(new Blob(
          [Uint8Array.from(result.resource.bytes).buffer],
          { type: result.resource.mediaType },
        ))
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setCoverState({
          key: travelId,
          status: 'ready',
          source: objectUrl,
          alt: result.illustration.alt,
        })
      } catch {
        setCoverState({ key: travelId, status: 'error' })
      }
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [travelId, onLoadCover])

  return coverState?.key === travelId ? coverState : undefined
}

function CoverArt() {
  return <span className="travel-cover-sun" aria-hidden="true" />
}

function FeaturedCover({ entry, onLoadCover }: Pick<TravelEntryProps, 'entry' | 'onLoadCover'>) {
  const cover = useTravelCover(entry.travelId, onLoadCover)
  if (cover?.status === 'ready') {
    return (
      <figure className="travel-cover">
        <img src={cover.source} alt={cover.alt} />
      </figure>
    )
  }
  return (
    <div
      className="travel-cover travel-cover-fallback"
      role="img"
      aria-label={
        cover
          ? `Aucune couverture disponible pour ${entry.title}`
          : `Chargement de la couverture de ${entry.title}`
      }
    >
      <CoverArt />
    </div>
  )
}

function ThumbnailCover({ entry, onLoadCover }: Pick<TravelEntryProps, 'entry' | 'onLoadCover'>) {
  const cover = useTravelCover(entry.travelId, onLoadCover)
  return (
    <span className="travel-thumbnail" aria-hidden="true">
      {cover?.status === 'ready' ? (
        <img src={cover.source} alt="" />
      ) : (
        <span className="travel-cover-fallback"><CoverArt /></span>
      )}
    </span>
  )
}

const timingBadges: Record<TravelTiming, { label: string; className: string }> = {
  ongoing: { label: 'En cours', className: 'status-pill status-pill-sage' },
  upcoming: { label: 'À venir', className: 'status-pill status-pill-sun' },
  past: { label: 'Terminé', className: 'status-pill status-pill-neutral' },
}

function TimingBadge({ timing }: { readonly timing: TravelTiming }) {
  const badge = timingBadges[timing]
  return (
    <span className={badge.className}>
      {timing === 'past' ? <CheckCircleIcon size={15} /> : <ClockIcon size={15} />}
      {badge.label}
    </span>
  )
}

type OptionsState = 'closed' | 'menu' | 'confirm'

function useTravelOptions<Container extends HTMLElement>() {
  const [state, setState] = useState<OptionsState>('closed')
  const containerRef = useRef<Container>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (state !== 'menu') return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setState('closed')
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [state])

  useEffect(() => {
    if (state === 'confirm') confirmationRef.current?.focus()
  }, [state])

  function close() {
    setState('closed')
    toggleRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && state !== 'closed') {
      event.stopPropagation()
      close()
    }
  }

  return {
    state,
    panelId,
    containerRef,
    toggleRef,
    confirmationRef,
    toggle: () => setState((current) => (current === 'closed' ? 'menu' : 'closed')),
    requestDelete: () => setState('confirm'),
    close,
    handleKeyDown,
  }
}

interface OptionsToggleProps {
  readonly title: string
  readonly toggleRef: RefObject<HTMLButtonElement | null>
  readonly expanded: boolean
  readonly panelId: string
  readonly onToggle: () => void
}

function OptionsToggle({ title, toggleRef, expanded, panelId, onToggle }: OptionsToggleProps) {
  return (
    <button
      ref={toggleRef}
      className="round-button round-button-outline"
      type="button"
      aria-label={`Plus d’options pour ${title}`}
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <MoreIcon size={22} />
    </button>
  )
}

interface OptionsPanelProps {
  readonly entry: TravelLibraryEntry
  readonly state: OptionsState
  readonly panelId: string
  readonly confirmationRef: RefObject<HTMLDivElement | null>
  readonly onRequestDelete: () => void
  readonly onClose: () => void
  readonly onDelete: (entry: TravelLibraryEntry) => void
}

function OptionsPanel({
  entry,
  state,
  panelId,
  confirmationRef,
  onRequestDelete,
  onClose,
  onDelete,
}: OptionsPanelProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <div id={panelId} className="travel-options" hidden={state === 'closed'}>
      {state === 'menu' && (
        <div className="travel-options-menu">
          <button
            className="menu-action menu-action-danger"
            type="button"
            aria-label={`Supprimer ${entry.title}`}
            onClick={onRequestDelete}
          >
            <TrashIcon />
            Supprimer ce voyage
          </button>
        </div>
      )}
      {state === 'confirm' && (
        <div
          ref={confirmationRef}
          className="delete-confirmation"
          role="group"
          tabIndex={-1}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <TrashIcon className="delete-confirmation-icon" />
          <div className="delete-confirmation-content">
            <p id={titleId} className="delete-confirmation-title">
              Supprimer « {entry.title} » ?
            </p>
            <p id={descriptionId}>
              Ses notes et checklists seront aussi supprimées de cet appareil.
              Cette action est définitive.
            </p>
            <div className="delete-confirmation-actions">
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onClose()
                  onDelete(entry)
                }}
              >
                Supprimer définitivement
              </button>
              <button className="secondary-button" type="button" onClick={onClose}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function FeaturedTravelCard({
  entry,
  timing,
  onOpen,
  onDelete,
  onLoadCover,
}: TravelEntryProps & { readonly timing: TravelTiming }) {
  const {
    state,
    panelId,
    containerRef,
    toggleRef,
    confirmationRef,
    toggle,
    requestDelete,
    close,
    handleKeyDown,
  } = useTravelOptions<HTMLElement>()
  const titleId = useId()

  return (
    <article
      ref={containerRef}
      className="next-travel"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <div className="next-travel-cover">
        <FeaturedCover entry={entry} onLoadCover={onLoadCover} />
        <TimingBadge timing={timing} />
      </div>
      <div className="next-travel-body">
        <h3 id={titleId} className="card-title">{entry.title}</h3>
        <p className="next-travel-destination">{entry.destination}</p>
        <p className="next-travel-dates">
          <CalendarIcon size={18} className="icon-accent" />
          <span>
            {formatTravelDates(entry.startDate, entry.endDate)} ·{' '}
            {travelDurationLabel(entry.startDate, entry.endDate)}
          </span>
        </p>
        <div className="next-travel-actions">
          <button
            className="primary-button next-travel-open"
            type="button"
            aria-label={`Ouvrir ${entry.title}`}
            onClick={() => onOpen(entry.travelId)}
          >
            Ouvrir le voyage
          </button>
          <OptionsToggle
            title={entry.title}
            toggleRef={toggleRef}
            expanded={state !== 'closed'}
            panelId={panelId}
            onToggle={toggle}
          />
        </div>
        <OptionsPanel
          entry={entry}
          state={state}
          panelId={panelId}
          confirmationRef={confirmationRef}
          onRequestDelete={requestDelete}
          onClose={close}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

export function CompactTravelItem({
  entry,
  onOpen,
  onDelete,
  onLoadCover,
}: TravelEntryProps) {
  const {
    state,
    panelId,
    containerRef,
    toggleRef,
    confirmationRef,
    toggle,
    requestDelete,
    close,
    handleKeyDown,
  } = useTravelOptions<HTMLLIElement>()
  const metaId = useId()

  return (
    <li ref={containerRef} className="travel-row" onKeyDown={handleKeyDown}>
      <div className="travel-row-main">
        <button
          className="travel-row-open"
          type="button"
          aria-label={`Ouvrir ${entry.title}`}
          aria-describedby={metaId}
          onClick={() => onOpen(entry.travelId)}
        >
          <ThumbnailCover entry={entry} onLoadCover={onLoadCover} />
          <span className="travel-row-text">
            <span className="travel-row-title">{entry.title}</span>
            <span id={metaId} className="travel-row-meta">
              {entry.destination} · {formatTravelDates(entry.startDate, entry.endDate)}
            </span>
          </span>
          <ChevronRightIcon className="travel-row-chevron" />
        </button>
        <OptionsToggle
          title={entry.title}
          toggleRef={toggleRef}
          expanded={state !== 'closed'}
          panelId={panelId}
          onToggle={toggle}
        />
      </div>
      <OptionsPanel
        entry={entry}
        state={state}
        panelId={panelId}
        confirmationRef={confirmationRef}
        onRequestDelete={requestDelete}
        onClose={close}
        onDelete={onDelete}
      />
    </li>
  )
}
