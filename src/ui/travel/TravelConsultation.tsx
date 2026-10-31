import { useEffect, useRef, useState } from 'react'
import { getTodayState, type Clock } from '../../application/travelConsultation'
import { findStepWithDay, findTravelPiece } from '../../application/travelPieces'
import type { Travel, TravelDocument } from '../../domain/voyage/model'
import {
  checklistItemStateKey,
  type NewUserPiece,
  type PersistedTravel,
  type TravelPersonalState,
  type UserPieceMetadata,
} from '../../persistence/model'
import type { RequestScreenWakeLock } from '../../services/screenWakeLock'
import { ChecklistIcon, CompassIcon, ListIcon, PaperclipIcon } from '../icons'
import { AddPieceView, type UserPieceSaveResult } from './AddPieceView'
import { BackToLibraryButton } from './ConsultationActions'
import { Overview } from './OverviewView'
import { PieceSheetView } from './PieceSheetView'
import { PiecesView } from './PiecesView'
import { PreparationView } from './PreparationView'
import { ProgramView } from './ProgramView'
import { StepView } from './StepView'
import { programTarget } from './consultationHelpers'
import type {
  ContextActionFeedback,
  IllustrationResourceLoadResult,
  PersonalSaveResult,
  TravelView,
  UserPieceFileLoadResult,
} from './consultationTypes'
import { accommodationElementId } from './pieceHelpers'

export type {
  TravelView,
  ContextActionFeedback,
  PersonalSaveResult,
  UserPieceFileLoadResult,
  IllustrationResourceLoadResult,
} from './consultationTypes'
export type { UserPieceSaveResult }

interface TravelConsultationProps {
  persistedTravel: PersistedTravel
  view: TravelView
  clock: Clock
  online: boolean
  actionFeedback?: ContextActionFeedback
  personalState: TravelPersonalState
  noteSaveDelayMs?: number
  onNavigate(view: TravelView): void
  onBackToLibrary(): void
  /** Résout à `true` lorsque l’adresse a été copiée. */
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
  onLoadIllustrationResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
  /** Résout à `undefined` lorsque le stockage local ne peut pas être lu. */
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
  onSetChecklistItemChecked(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): Promise<PersonalSaveResult>
  onSaveNote(text: string): Promise<PersonalSaveResult>
  /** Pièces ajoutées sur l’appareil pour ce voyage, sans leurs octets. */
  userPieces: readonly UserPieceMetadata[]
  onAddUserPiece(piece: NewUserPiece): Promise<UserPieceSaveResult>
  onRenameUserPiece(pieceId: string, title: string): Promise<PersonalSaveResult>
  onDeleteUserPiece(pieceId: string): Promise<PersonalSaveResult>
  onOpenUserPiece(piece: UserPieceMetadata): void
  onLoadUserPieceFile(travelId: string, pieceId: string): Promise<UserPieceFileLoadResult>
  /** Injectable pour les tests ; par défaut, l’API Screen Wake Lock du navigateur. */
  requestWakeLock?: RequestScreenWakeLock
}

function viewLabel(
  view: TravelView,
  travel: Travel,
  userPieces: readonly UserPieceMetadata[],
) {
  if (view.kind === 'summary') return 'Aperçu'
  if (view.kind === 'pieces') return 'Pièces'
  if (view.kind === 'piece') {
    const label = findTravelPiece(travel, view.pieceKind, view.pieceId, userPieces)?.label
    return label ? `Pièce — ${label}` : 'Pièce'
  }
  if (view.kind === 'add-piece') return 'Ajouter une pièce'
  if (view.kind === 'step') {
    const stepTitle = findStepWithDay(travel, view.stepId)?.step.title
    return stepTitle ? `Étape — ${stepTitle}` : 'Étape'
  }
  if (view.kind === 'preparation') return 'Préparation'
  if (view.kind === 'today') return 'Programme d’aujourd’hui'
  const dayTitle = travel.days.find((day) => day.id === view.dayId)?.title
  return dayTitle ? `Programme — ${dayTitle}` : 'Programme'
}

export function TravelConsultation({
  persistedTravel,
  view,
  clock,
  online,
  actionFeedback,
  personalState,
  noteSaveDelayMs = 500,
  onNavigate,
  onBackToLibrary,
  onCopyAddress,
  onOpenDocument,
  onLoadIllustrationResource,
  onListLocalResourceIds,
  onSetChecklistItemChecked,
  onSaveNote,
  userPieces,
  onAddUserPiece,
  onRenameUserPiece,
  onDeleteUserPiece,
  onOpenUserPiece,
  onLoadUserPieceFile,
  requestWakeLock,
}: TravelConsultationProps) {
  const { travel } = persistedTravel
  const [checkedItemKeys, setCheckedItemKeys] = useState(
    () => new Set(personalState.checkedItemKeys),
  )
  const [checklistFeedback, setChecklistFeedback] = useState<
    Record<string, 'saving' | 'saved' | 'error'>
  >({})
  const todayState = getTodayState(travel, clock)
  // « Aujourd’hui » n’est qu’un raccourci : pendant le voyage, il affiche la
  // journée du jour comme n’importe quelle journée.
  const requestedView: TravelView = view.kind === 'today' && todayState.status === 'day'
    ? { kind: 'day', dayId: todayState.day.id }
    : view
  const selectedDay = requestedView.kind === 'day'
    ? travel.days.find((day) => day.id === requestedView.dayId)
    : undefined
  const selectedStep = requestedView.kind === 'step'
    ? findStepWithDay(travel, requestedView.stepId)
    : undefined
  const selectedPiece = requestedView.kind === 'piece'
    ? findTravelPiece(travel, requestedView.pieceKind, requestedView.pieceId, userPieces)
    : undefined
  const safeView = (requestedView.kind === 'day' && !selectedDay)
    || (requestedView.kind === 'step' && !selectedStep)
    || (requestedView.kind === 'piece' && !selectedPiece)
    ? { kind: 'summary' } as const
    : requestedView
  const programActive = safeView.kind === 'day'
    || safeView.kind === 'today'
    || safeView.kind === 'step'
  const workspaceRef = useRef<HTMLElement>(null)
  const programDay = safeView.kind === 'day'
    ? selectedDay
    : safeView.kind === 'step'
      ? selectedStep?.day
      : undefined
  const programDayIndex = programDay ? travel.days.indexOf(programDay) : -1
  const viewKey = safeView.kind === 'day'
    ? `day:${safeView.dayId}`
    : safeView.kind === 'step'
      ? `step:${safeView.stepId}`
      : safeView.kind === 'piece'
        ? `piece:${safeView.pieceKind}:${safeView.pieceId}`
        : safeView.kind === 'add-piece'
          ? `add-piece:${JSON.stringify(safeView.attachment ?? null)}`
          : safeView.kind === 'pieces' && safeView.accommodationId
            ? `pieces:${safeView.accommodationId}`
            : safeView.kind
  const focusedAccommodationId = safeView.kind === 'pieces'
    ? safeView.accommodationId
    : undefined
  const previousViewKey = useRef(viewKey)

  useEffect(() => {
    if (previousViewKey.current === viewKey) return
    previousViewKey.current = viewKey
    const accommodation = focusedAccommodationId
      ? document.getElementById(accommodationElementId(focusedAccommodationId))
      : null
    if (accommodation) {
      accommodation.scrollIntoView?.({ block: 'start' })
      accommodation.focus()
      return
    }
    workspaceRef.current?.scrollIntoView?.({ block: 'start' })
  }, [viewKey, focusedAccommodationId])
  const actions = {
    online,
    onCopyAddress,
    onOpenDocument,
    onLoadIllustrationResource,
  }

  async function toggleChecklistItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ) {
    const key = checklistItemStateKey(checklistId, itemId)
    const previous = checkedItemKeys.has(key)
    setCheckedItemKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
    setChecklistFeedback((current) => ({ ...current, [key]: 'saving' }))
    const result = await onSetChecklistItemChecked(checklistId, itemId, checked)
    if (!result.ok) {
      setCheckedItemKeys((current) => {
        const next = new Set(current)
        if (previous) next.add(key)
        else next.delete(key)
        return next
      })
    }
    setChecklistFeedback((current) => ({
      ...current,
      [key]: result.ok ? 'saved' : 'error',
    }))
  }

  const checklistState = {
    checkedItemKeys,
    checklistFeedback,
    onToggleChecklistItem: (
      checklistId: string,
      itemId: string,
      checked: boolean,
    ) => {
      void toggleChecklistItem(checklistId, itemId, checked)
    },
  }

  const sections: readonly {
    readonly label: string
    readonly icon: typeof CompassIcon
    readonly active: boolean
    readonly target: () => TravelView
  }[] = [
    { label: 'Aperçu', icon: CompassIcon, active: safeView.kind === 'summary', target: () => ({ kind: 'summary' }) },
    { label: 'Programme', icon: ListIcon, active: programActive, target: () => programTarget(travel, clock) },
    { label: 'Pièces', icon: PaperclipIcon, active: safeView.kind === 'pieces'
      || safeView.kind === 'piece'
      || safeView.kind === 'add-piece', target: () => ({ kind: 'pieces' }) },
    { label: 'Préparation', icon: ChecklistIcon, active: safeView.kind === 'preparation', target: () => ({ kind: 'preparation' }) },
  ]

  return (
    <section ref={workspaceRef} className="travel-workspace" aria-label={`Voyage ${travel.title}`}>
      {safeView.kind !== 'summary' && (
        <header className="travel-topbar">
          <BackToLibraryButton onBackToLibrary={onBackToLibrary} />
          <div className="travel-topbar-text">
            <h1 className="travel-topbar-title">{travel.title}</h1>
            {programDayIndex >= 0 && (
              <p className="travel-topbar-subtitle">
                Jour {programDayIndex + 1} sur {travel.days.length}
              </p>
            )}
          </div>
        </header>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        Section active : {viewLabel(safeView, travel, userPieces)}
      </p>
      {actionFeedback && (
        <p
          className={`action-message travel-feedback ${actionFeedback.status === 'error'
            ? 'action-error'
            : 'action-success'}`}
          role={actionFeedback.status === 'error' ? 'alert' : 'status'}
        >
          {actionFeedback.message}
        </p>
      )}
      {safeView.kind === 'summary' && (
        <Overview
          travel={travel}
          clock={clock}
          onNavigate={onNavigate}
          onBackToLibrary={onBackToLibrary}
          onCopyAddress={onCopyAddress}
          onLoadIllustrationResource={onLoadIllustrationResource}
        />
      )}
      {(safeView.kind === 'day' || safeView.kind === 'today') && (
        <ProgramView
          travel={travel}
          view={safeView}
          clock={clock}
          personalState={checklistState}
          userPieces={userPieces}
          onNavigate={onNavigate}
          {...actions}
        />
      )}
      {safeView.kind === 'step' && selectedStep && (
        <StepView
          travel={travel}
          day={selectedStep.day}
          step={selectedStep.step}
          userPieces={userPieces}
          personalState={checklistState}
          online={online}
          onNavigate={onNavigate}
          onOpenDocument={onOpenDocument}
        />
      )}
      {safeView.kind === 'pieces' && (
        <PiecesView
          travel={travel}
          userPieces={userPieces}
          online={online}
          onNavigate={onNavigate}
          onCopyAddress={onCopyAddress}
          onListLocalResourceIds={onListLocalResourceIds}
        />
      )}
      {safeView.kind === 'piece' && selectedPiece && (
        <PieceSheetView
          travel={travel}
          piece={selectedPiece}
          online={online}
          onNavigate={onNavigate}
          onOpenDocument={onOpenDocument}
          onListLocalResourceIds={onListLocalResourceIds}
          onOpenUserPiece={onOpenUserPiece}
          onLoadUserPieceFile={onLoadUserPieceFile}
          onRenameUserPiece={onRenameUserPiece}
          onDeleteUserPiece={async (pieceId) => {
            const result = await onDeleteUserPiece(pieceId)
            if (result.ok) onNavigate({ kind: 'pieces' })
            return result
          }}
          requestWakeLock={requestWakeLock}
        />
      )}
      {safeView.kind === 'add-piece' && (
        <AddPieceView
          travel={travel}
          initialAttachment={safeView.attachment}
          onSave={onAddUserPiece}
          onSaved={(piece) => onNavigate({
            kind: 'piece',
            pieceKind: 'added',
            pieceId: piece.pieceId,
          })}
          onCancel={() => onNavigate(
            safeView.attachment?.type === 'step'
              ? { kind: 'step', stepId: safeView.attachment.stepId }
              : { kind: 'pieces' },
          )}
        />
      )}
      {safeView.kind === 'preparation' && (
        <PreparationView
          travel={travel}
          personalState={checklistState}
          online={online}
          onOpenDocument={onOpenDocument}
          initialNote={personalState.note}
          noteSaveDelayMs={noteSaveDelayMs}
          onSaveNote={onSaveNote}
        />
      )}
      <nav className="travel-bottom-nav" aria-label="Sections du voyage">
        <ul>
          {sections.map(({ label, icon: SectionIcon, active, target }) => (
            <li key={label}>
              <button
                className="travel-nav-button"
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(target())}
              >
                <span className="travel-nav-icon" aria-hidden="true">
                  <SectionIcon size={22} />
                </span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
