import { useEffect, useState } from 'react'
import type { TravelCoverLoadResult } from '../../application/loadTravelCover'
import type { TravelLibraryEntry } from '../../persistence/model'

interface TravelLibraryCardProps {
  readonly entry: TravelLibraryEntry
  readonly onOpen: (travelId: string) => void
  readonly onDelete: (entry: TravelLibraryEntry) => void
  readonly onLoadCover: (travelId: string) => Promise<TravelCoverLoadResult>
}

type CoverState =
  | { readonly key: string; readonly status: 'absent' | 'error' }
  | {
      readonly key: string
      readonly status: 'ready'
      readonly source: string
      readonly alt: string
    }

function CoverFallback({
  title,
  loading,
}: {
  title: string
  loading: boolean
}) {
  return (
    <div
      className="travel-card-cover travel-card-cover-fallback"
      role="img"
      aria-label={
        loading
          ? `Chargement de la couverture de ${title}`
          : `Aucune couverture disponible pour ${title}`
      }
    >
      <span aria-hidden="true">CV</span>
    </div>
  )
}

export function TravelLibraryCard({
  entry,
  onOpen,
  onDelete,
  onLoadCover,
}: TravelLibraryCardProps) {
  const [coverState, setCoverState] = useState<CoverState>()

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined

    void onLoadCover(entry.travelId).then((result) => {
      if (!active) return
      if (result.status !== 'ready') {
        setCoverState({ key: entry.travelId, status: result.status })
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
          key: entry.travelId,
          status: 'ready',
          source: objectUrl,
          alt: result.illustration.alt,
        })
      } catch {
        setCoverState({ key: entry.travelId, status: 'error' })
      }
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [entry.travelId, onLoadCover])

  const currentCover = coverState?.key === entry.travelId
    ? coverState
    : undefined

  return (
    <li className="travel-card">
      {currentCover?.status === 'ready' ? (
        <figure className="travel-card-cover">
          <img src={currentCover.source} alt={currentCover.alt} />
        </figure>
      ) : (
        <CoverFallback title={entry.title} loading={!currentCover} />
      )}
      <div className="travel-card-content">
        <h4>{entry.title}</h4>
        <p>{entry.destination}</p>
        <p className="travel-dates">
          <time dateTime={entry.startDate}>{entry.startDate}</time> au{' '}
          <time dateTime={entry.endDate}>{entry.endDate}</time>
        </p>
      </div>
      <div className="travel-actions">
        <button
          className="primary-button"
          type="button"
          aria-label={`Ouvrir ${entry.title}`}
          onClick={() => onOpen(entry.travelId)}
        >
          Ouvrir
        </button>
        <button
          className="danger-button"
          type="button"
          aria-label={`Supprimer ${entry.title}`}
          onClick={() => onDelete(entry)}
        >
          Supprimer
        </button>
      </div>
    </li>
  )
}
