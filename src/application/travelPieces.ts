import type {
  EntityId,
  Travel,
  TravelDay,
  TravelDocument,
  TravelReservation,
  TravelStep,
} from '../domain/voyage/model'

/**
 * Vue dérivée des « pièces » d’un voyage : documents et réservations du
 * dossier importé, rattachés aux journées et étapes uniquement par
 * identifiants (`documentIds`, `reservationIds`). Aucune association n’est
 * déduite d’un libellé, d’un nom de fichier ou d’une position.
 */

export type TravelPieceAttachment =
  | { readonly type: 'day'; readonly day: TravelDay }
  | { readonly type: 'step'; readonly day: TravelDay; readonly step: TravelStep }

/** Les pièces du lot 1 proviennent toutes du dossier importé. */
export type TravelPieceOrigin = 'package'

interface TravelPieceBase {
  readonly id: EntityId
  readonly label: string
  readonly origin: TravelPieceOrigin
  readonly attachments: readonly TravelPieceAttachment[]
}

export type TravelPiece =
  | (TravelPieceBase & {
      readonly kind: 'document'
      readonly document: TravelDocument
    })
  | (TravelPieceBase & {
      readonly kind: 'reservation'
      readonly reservation: TravelReservation
    })

export type TravelPieceGroup =
  | { readonly type: 'travel'; readonly pieces: readonly TravelPiece[] }
  | {
      readonly type: 'day'
      readonly day: TravelDay
      readonly pieces: readonly TravelPiece[]
    }

interface AttachmentCollector {
  readonly attachments: TravelPieceAttachment[]
  readonly keys: Set<string>
}

function attachmentKey(attachment: TravelPieceAttachment) {
  return attachment.type === 'day'
    ? `day:${attachment.day.id}`
    : `step:${attachment.step.id}`
}

function addAttachment(
  collectors: Map<EntityId, AttachmentCollector>,
  pieceId: EntityId,
  attachment: TravelPieceAttachment,
) {
  const collector = collectors.get(pieceId)
  if (!collector) return
  const key = attachmentKey(attachment)
  if (collector.keys.has(key)) return
  collector.keys.add(key)
  collector.attachments.push(attachment)
}

function emptyCollectors(ids: readonly EntityId[]) {
  return new Map(ids.map((id) => [
    id,
    { attachments: [], keys: new Set<string>() } satisfies AttachmentCollector,
  ]))
}

/**
 * Calcule la liste des pièces dans l’ordre chronologique de leur premier
 * rattachement ; les pièces sans rattachement suivent l’ordre du dossier.
 * Un document référencé par une réservation hérite des rattachements de
 * celle-ci, toujours par identifiant.
 */
export function listTravelPieces(travel: Travel): readonly TravelPiece[] {
  const documentCollectors = emptyCollectors(travel.documents.map(({ id }) => id))
  const reservationCollectors = emptyCollectors(travel.reservations.map(({ id }) => id))
  const reservationsById = new Map(
    travel.reservations.map((reservation) => [reservation.id, reservation]),
  )

  function attach(
    documentIds: readonly EntityId[],
    reservationIds: readonly EntityId[],
    attachment: TravelPieceAttachment,
  ) {
    reservationIds.forEach((reservationId) => {
      addAttachment(reservationCollectors, reservationId, attachment)
      reservationsById.get(reservationId)?.documentIds.forEach((documentId) => {
        addAttachment(documentCollectors, documentId, attachment)
      })
    })
    documentIds.forEach((documentId) => {
      addAttachment(documentCollectors, documentId, attachment)
    })
  }

  travel.days.forEach((day) => {
    attach(day.documentIds, day.reservationIds, { type: 'day', day })
    day.steps.forEach((step) => {
      attach(step.documentIds, step.reservationIds, { type: 'step', day, step })
    })
  })

  const pieces: TravelPiece[] = [
    ...travel.documents.map((document): TravelPiece => ({
      kind: 'document',
      id: document.id,
      label: document.label,
      origin: 'package',
      document,
      attachments: documentCollectors.get(document.id)?.attachments ?? [],
    })),
    ...travel.reservations.map((reservation): TravelPiece => ({
      kind: 'reservation',
      id: reservation.id,
      label: reservation.label,
      origin: 'package',
      reservation,
      attachments: reservationCollectors.get(reservation.id)?.attachments ?? [],
    })),
  ]

  const positions = attachmentPositions(travel)
  const firstPosition = (piece: TravelPiece) => {
    const first = piece.attachments[0]
    return first ? positions.get(attachmentKey(first)) ?? -1 : -1
  }
  return pieces
    .map((piece, index) => ({ piece, index, position: firstPosition(piece) }))
    .sort((left, right) => (
      left.position - right.position || left.index - right.index
    ))
    .map(({ piece }) => piece)
}

function attachmentPositions(travel: Travel) {
  const positions = new Map<string, number>()
  travel.days.forEach((day) => {
    positions.set(`day:${day.id}`, positions.size)
    day.steps.forEach((step) => positions.set(`step:${step.id}`, positions.size))
  })
  return positions
}

/**
 * Regroupe les pièces par journée : « Tout le voyage » d’abord, puis une
 * section par journée dans l’ordre du programme. Une pièce rattachée à
 * plusieurs journées n’apparaît qu’une fois, sous sa première journée.
 * Aucune section vide n’est produite.
 */
export function groupTravelPiecesByDay(
  travel: Travel,
  pieces: readonly TravelPiece[],
): readonly TravelPieceGroup[] {
  const travelPieces = pieces.filter((piece) => piece.attachments.length === 0)
  const groups: TravelPieceGroup[] = travelPieces.length > 0
    ? [{ type: 'travel', pieces: travelPieces }]
    : []
  travel.days.forEach((day) => {
    const dayPieces = pieces.filter((piece) => piece.attachments[0]?.day.id === day.id)
    if (dayPieces.length > 0) groups.push({ type: 'day', day, pieces: dayPieces })
  })
  return groups
}

/** Identifiants des ressources que les documents du voyage doivent trouver en local. */
export function documentResourceIds(travel: Travel): readonly EntityId[] {
  return [...new Set(travel.documents.map((document) => document.resourceId))]
}

/**
 * Vrai seulement si le voyage contient au moins un document et que chacune de
 * leurs ressources est effectivement présente dans le stockage local.
 */
export function allDocumentsStoredLocally(
  travel: Travel,
  localResourceIds: ReadonlySet<EntityId>,
) {
  const required = documentResourceIds(travel)
  return required.length > 0 && required.every((id) => localResourceIds.has(id))
}

/** Pièces rattachées à une journée, directement ou par l’une de ses étapes. */
export function piecesForDay(
  pieces: readonly TravelPiece[],
  dayId: EntityId,
): readonly TravelPiece[] {
  return pieces.filter((piece) => (
    piece.attachments.some((attachment) => attachment.day.id === dayId)
  ))
}

/** Documents rattachés à une étape, directement ou par l’une de ses réservations. */
export function documentPiecesForStep(
  pieces: readonly TravelPiece[],
  stepId: EntityId,
): readonly Extract<TravelPiece, { kind: 'document' }>[] {
  return pieces.flatMap((piece) => (
    piece.kind === 'document'
    && piece.attachments.some((attachment) => (
      attachment.type === 'step' && attachment.step.id === stepId
    ))
      ? [piece]
      : []
  ))
}

/** Retrouve une étape et sa journée par identifiant stable. */
export function findStepWithDay(
  travel: Travel,
  stepId: EntityId,
): { readonly day: TravelDay; readonly step: TravelStep } | undefined {
  for (const day of travel.days) {
    const step = day.steps.find((candidate) => candidate.id === stepId)
    if (step) return { day, step }
  }
  return undefined
}

export type TravelPieceKind = TravelPiece['kind']

/** Retrouve une pièce par sa nature et son identifiant stable. */
export function findTravelPiece(
  travel: Travel,
  kind: TravelPieceKind,
  id: EntityId,
): TravelPiece | undefined {
  return listTravelPieces(travel).find((piece) => piece.kind === kind && piece.id === id)
}
