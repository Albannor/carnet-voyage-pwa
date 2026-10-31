import { findPlace } from '../../application/travelConsultation'
import {
  allDocumentsStoredLocally,
  groupTravelPiecesByDay,
  listTravelPieces,
  type TravelPiece,
} from '../../application/travelPieces'
import type { Travel, TravelAccommodation } from '../../domain/voyage/model'
import type { UserPieceMetadata } from '../../persistence/model'
import { DownloadIcon } from '../icons'
import { formatCompactDate } from '../travelDates'
import { CopyAddressButton, ExternalLink } from './ConsultationActions'
import { IllustrationCredits } from './Illustrations'
import { AddPieceButton, PieceRowButton } from './PieceRows'
import { useLocalResourceIds } from './consultationHooks'
import type { TravelView } from './consultationTypes'
import { uniqueContextualLinks } from './contextualLinks'
import { accommodationElementId, missingLocally, pieceView } from './pieceHelpers'

/**
 * Fiche unique d’un hébergement. Ses pièces sont celles rattachées, par
 * identifiant, aux étapes qui portent son `accommodationId` ; elles renvoient
 * à leur fiche plutôt que d’être recopiées.
 */
function AccommodationDetails({
  travel,
  accommodation,
  pieces,
  online,
  onCopyAddress,
  onNavigate,
}: {
  travel: Travel
  accommodation: TravelAccommodation
  pieces: readonly TravelPiece[]
  online: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onNavigate(view: TravelView): void
}) {
  const place = findPlace(travel, accommodation.placeId)
  const accommodationPieces = pieces.filter((piece) => piece.attachments.some(
    (attachment) => attachment.type === 'step'
      && attachment.step.accommodationId === accommodation.id,
  ))

  return (
    <article
      className="practical-card accommodation-details"
      id={accommodationElementId(accommodation.id)}
      tabIndex={-1}
      aria-labelledby={`${accommodationElementId(accommodation.id)}-title`}
    >
      <p className="card-label">Hébergement</p>
      <h4 id={`${accommodationElementId(accommodation.id)}-title`}>{accommodation.label}</h4>
      <p>
        <time dateTime={accommodation.period.start}>
          {formatCompactDate(accommodation.period.start, travel.locale)}
        </time>
        {' '}–{' '}
        <time dateTime={accommodation.period.end}>
          {formatCompactDate(accommodation.period.end, travel.locale)}
        </time>
      </p>
      {place?.address && (
        <>
          <address>{place.address}</address>
          <CopyAddressButton
            address={place.address}
            placeLabel={place.label}
            targetLabel={accommodation.label}
            onCopyAddress={onCopyAddress}
          />
        </>
      )}
      {place && place.links.length > 0 && (
        <ul className="practical-link-list">
          {uniqueContextualLinks(place.links).map((link) => (
            <li key={link.id}>
              <ExternalLink
                link={link}
                online={online}
                context={accommodation.label}
              />
            </li>
          ))}
        </ul>
      )}
      {accommodationPieces.length > 0 && (
        <ul className="practical-link-list" aria-label={`Pièces de ${accommodation.label}`}>
          {accommodationPieces.map((piece) => (
            <li key={`${piece.kind}:${piece.id}`}>
              <button
                className="text-button"
                type="button"
                aria-label={`Voir la fiche ${piece.label}, pièce de ${accommodation.label}`}
                onClick={() => onNavigate(pieceView(piece))}
              >
                {piece.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/**
 * Espace Pièces : les pièces du voyage, puis les repères stables du dossier
 * (hébergements, lieux utiles) et les crédits photographiques.
 */
export function PiecesView({
  travel,
  userPieces,
  online,
  onNavigate,
  onCopyAddress,
  onListLocalResourceIds,
}: {
  travel: Travel
  userPieces: readonly UserPieceMetadata[]
  online: boolean
  onNavigate(view: TravelView): void
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
}) {
  const localResourceIds = useLocalResourceIds(travel.id, onListLocalResourceIds)
  const pieces = listTravelPieces(travel, userPieces)
  const groups = groupTravelPiecesByDay(travel, pieces)
  const accommodationPlaceIds = new Set(
    travel.accommodations.map((accommodation) => accommodation.placeId),
  )
  const otherPlaces = travel.places.filter((place) => !accommodationPlaceIds.has(place.id))

  // Les pièces ajoutées sont relues depuis IndexedDB : elles sont présentes par construction.
  const allStoredLocally = localResourceIds !== undefined
    && (travel.documents.length > 0 || userPieces.length > 0)
    && (travel.documents.length === 0 || allDocumentsStoredLocally(travel, localResourceIds))

  return (
    <div className="consultation-view pieces-view" aria-labelledby="pieces-title">
      <header className="section-heading pieces-heading">
        <div>
          <p className="section-label">Pièces</p>
          <h2 id="pieces-title">Pièces du voyage</h2>
          <p>
            {pieces.length === 0
              ? 'Aucune pièce'
              : `${pieces.length} ${pieces.length > 1 ? 'pièces' : 'pièce'}`}
          </p>
        </div>
        <AddPieceButton
          label="Ajouter une pièce"
          onClick={() => onNavigate({ kind: 'add-piece' })}
        />
      </header>
      {pieces.length === 0 && (
        <p className="empty-state">
          Ce voyage ne contient aucun document ni aucune réservation. Les billets,
          confirmations et autres pièces du dossier apparaîtront ici, comme celles
          que vous ajoutez sur cet appareil.
        </p>
      )}
      {allStoredLocally && (
        <p className="pieces-offline-badge">
          <DownloadIcon size={16} />
          <span>Toutes disponibles hors connexion</span>
        </p>
      )}
      {groups.map((group) => {
        const groupDayId = group.type === 'day' ? group.day.id : undefined
        const titleId = group.type === 'day'
          ? `pieces-group-${group.day.id}`
          : 'pieces-group-travel'
        return (
          <section className="pieces-group" key={titleId} aria-labelledby={titleId}>
            <h3 className="pieces-group-title" id={titleId}>
              {group.type === 'travel'
                ? 'Tout le voyage'
                : (
                    <>
                      <time dateTime={group.day.date}>
                        {formatCompactDate(group.day.date, travel.locale)}
                      </time>{' '}
                      <span className="pieces-group-day">{group.day.title}</span>
                    </>
                  )}
            </h3>
            <ul className="pieces-list">
              {group.pieces.map((piece) => (
                <li key={`${piece.kind}:${piece.id}`}>
                  <PieceRowButton
                    piece={piece}
                    groupDayId={groupDayId}
                    locale={travel.locale}
                    missingLocally={missingLocally(piece, localResourceIds)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {travel.accommodations.length > 0 && (
        <section className="practical-group" aria-labelledby="accommodations-title">
          <h3 id="accommodations-title" className="pieces-group-title">Hébergements</h3>
          <div className="practical-card-grid">
            {travel.accommodations.map((accommodation) => (
              <AccommodationDetails
                key={accommodation.id}
                travel={travel}
                accommodation={accommodation}
                pieces={pieces}
                online={online}
                onCopyAddress={onCopyAddress}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}
      {otherPlaces.length > 0 && (
        <section className="practical-group" aria-labelledby="places-title">
          <h3 id="places-title" className="pieces-group-title">Lieux et transports utiles</h3>
          <div className="practical-card-grid">
            {otherPlaces.map((place) => (
              <article className="practical-card" key={place.id}>
                <h4>{place.label}</h4>
                {place.address && <address>{place.address}</address>}
                {place.links.length > 0 && (
                  <ul className="practical-link-list">
                    {uniqueContextualLinks(place.links).map((link) => (
                      <li key={link.id}>
                        <ExternalLink
                          link={link}
                          online={online}
                          context={place.label}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      <IllustrationCredits travel={travel} online={online} />
    </div>
  )
}
