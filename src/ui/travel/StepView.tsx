import { findPlace } from '../../application/travelConsultation'
import { filePiecesForStep, listTravelPieces } from '../../application/travelPieces'
import type {
  Travel,
  TravelDay,
  TravelDocument,
  TravelStep,
} from '../../domain/voyage/model'
import type { UserPieceMetadata } from '../../persistence/model'
import { ChevronLeftIcon, MapPinIcon } from '../icons'
import { formatCompactDate } from '../travelDates'
import {
  ChecklistCollection,
  ContextualLinkList,
  ReservationDetails,
} from './ConsultationActions'
import { AccommodationLink, AddPieceButton, PieceRowButton } from './PieceRows'
import { reservationsById, stepChecklists } from './consultationHelpers'
import type { PersonalStateProps, TravelView } from './consultationTypes'
import { uniqueContextualLinks } from './contextualLinks'

/** Espace d’une étape : son horaire, ses réservations, ses pièces, ses liens et sa checklist. */
export function StepView({
  travel,
  day,
  step,
  userPieces,
  personalState,
  online,
  onNavigate,
  onOpenDocument,
}: {
  travel: Travel
  day: TravelDay
  step: TravelStep
  userPieces: readonly UserPieceMetadata[]
  personalState: PersonalStateProps
  online: boolean
  onNavigate(view: TravelView): void
  onOpenDocument(document: TravelDocument): void
}) {
  const place = findPlace(travel, step.placeId)
  const links = uniqueContextualLinks(step.links, place?.links)
  const reservations = reservationsById(travel, step.reservationIds)
  const filePieces = filePiecesForStep(listTravelPieces(travel, userPieces), step.id)
  const checklists = stepChecklists(travel, step.id)
  // Les documents de l’étape sont listés une fois, dans « Pièces de cette étape ».
  const listedDocumentIds = new Set(
    filePieces.flatMap((piece) => (piece.kind === 'document' ? [piece.id] : [])),
  )

  return (
    <div className="consultation-view step-view" aria-labelledby="step-view-title">
      <button
        className="back-button"
        type="button"
        aria-label={`Retour à la journée : ${day.title}`}
        onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
      >
        <ChevronLeftIcon size={20} />
        <span>
          <time dateTime={day.date}>{formatCompactDate(day.date, travel.locale)}</time>
          {' · '}
          {day.title}
        </span>
      </button>
      <header className="step-view-header">
        <p className="step-time">
          {step.startsAt ? (
            <>
              <time dateTime={step.startsAt}>{step.startsAt}</time>
              {step.endsAt && (
                <>
                  <span aria-hidden="true">–</span>
                  <time dateTime={step.endsAt}>{step.endsAt}</time>
                </>
              )}
            </>
          ) : (
            'Sans horaire'
          )}
        </p>
        <h2 id="step-view-title" className="step-view-title">{step.title}</h2>
        {place && (
          <p className="step-place">
            <MapPinIcon size={18} />
            <span className="visually-hidden">Lieu : </span>
            <span>{place.label}</span>
          </p>
        )}
        {step.description && <p className="step-description">{step.description}</p>}
      </header>
      {reservations.map((reservation) => (
        <ReservationDetails
          key={reservation.id}
          travel={travel}
          reservation={reservation}
          online={online}
          onOpenDocument={onOpenDocument}
          excludedDocumentIds={listedDocumentIds}
        />
      ))}
      <section className="pieces-group" aria-labelledby="step-pieces-title">
        <h3 className="pieces-group-title" id="step-pieces-title">
          Pièces de cette étape{filePieces.length > 0 ? ` · ${filePieces.length}` : ''}
        </h3>
        {filePieces.length > 0 && (
          <ul className="pieces-list">
            {filePieces.map((piece) => (
              <li key={`${piece.kind}:${piece.id}`}>
                <PieceRowButton
                  piece={piece}
                  locale={travel.locale}
                  missingLocally={false}
                  detail={piece.origin === 'user'
                    ? 'Ajoutée sur cet appareil'
                    : 'Document du dossier'}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        )}
        <AddPieceButton
          label="Ajouter une pièce à cette étape"
          onClick={() => onNavigate({
            kind: 'add-piece',
            attachment: { type: 'step', stepId: step.id },
          })}
        />
      </section>
      {links.length > 0 && (
        <section className="step-view-links" aria-labelledby="step-links-title">
          <h3 className="pieces-group-title" id="step-links-title">Liens utiles</h3>
          <ContextualLinkList links={links} online={online} context={step.title} />
        </section>
      )}
      {checklists.length > 0 && (
        <section className="step-view-checklists" aria-labelledby="step-checklists-title">
          <h3 className="pieces-group-title" id="step-checklists-title">Checklist de l’étape</h3>
          <ChecklistCollection checklists={checklists} {...personalState} />
        </section>
      )}
      {step.accommodationId && (
        <AccommodationLink
          accommodationId={step.accommodationId}
          stepTitle={step.title}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
