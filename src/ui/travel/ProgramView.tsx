import { useEffect, useState, type KeyboardEvent } from 'react'
import {
  findAccommodationForDate,
  findPlace,
  getTodayState,
  type Clock,
} from '../../application/travelConsultation'
import { listTravelPieces, type TravelPiece } from '../../application/travelPieces'
import type { Travel, TravelDay, TravelVariant } from '../../domain/voyage/model'
import type { UserPieceMetadata } from '../../persistence/model'
import {
  CheckIcon,
  ChecklistIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  HomeIcon,
  MapPinIcon,
  PaperclipIcon,
  SwapIcon,
} from '../icons'
import {
  ChecklistCollection,
  ContextualLinkList,
  CopyAddressButton,
} from './ConsultationActions'
import { IllustrationCollection } from './Illustrations'
import { DayPieces } from './PieceRows'
import {
  VARIANT_LABELS,
  capitalize,
  checklistProgress,
  dayVariants,
  formatDate,
  formatDayParts,
  illustrationById,
  planBElementId,
  stepChecklists,
} from './consultationHelpers'
import type { ActionProps, PersonalStateProps, TravelView } from './consultationTypes'
import {
  linksNotCarriedByIllustration,
  stepIllustrationLink,
  uniqueContextualLinks,
} from './contextualLinks'
import { localTimeInTimeZone, stepProgress, type StepProgress } from './stepProgress'

function DaySelector({
  travel,
  selectedDayId,
  todayDayId,
  onNavigate,
}: {
  travel: Travel
  selectedDayId?: string
  todayDayId?: string
  onNavigate(view: TravelView): void
}) {
  function handleArrowNavigation(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const target = travel.days[index + direction]
    if (!target) return
    event.preventDefault()
    onNavigate({ kind: 'day', dayId: target.id })
  }

  if (travel.days.length === 0) return null
  return (
    <nav className="day-selector" aria-label="Choisir une journée">
      <ol>
        {travel.days.map((day, index) => {
          const selected = day.id === selectedDayId
          const isToday = day.id === todayDayId
          const parts = formatDayParts(day.date, travel.locale)
          return (
            <li key={day.id}>
              <button
                className={selected ? 'day-choice day-choice-active' : 'day-choice'}
                type="button"
                aria-current={selected ? 'page' : undefined}
                aria-label={`${formatDate(day.date, travel.locale)}${isToday ? ' (aujourd’hui)' : ''} — ${day.title}`}
                onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
                onKeyDown={(event) => handleArrowNavigation(event, index)}
              >
                <span className="day-choice-weekday">{parts.weekday}</span>
                <span className="day-choice-number">{parts.day}</span>
                {isToday && <span className="day-choice-today" />}
                {selected && <span className="visually-hidden">Journée active</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function AdjacentDayControls({
  travel,
  selectedDayId,
  onNavigate,
}: {
  travel: Travel
  selectedDayId: string
  onNavigate(view: TravelView): void
}) {
  const selectedIndex = travel.days.findIndex((day) => day.id === selectedDayId)
  const previous = selectedIndex > 0 ? travel.days[selectedIndex - 1] : undefined
  const next = selectedIndex >= 0 && selectedIndex < travel.days.length - 1
    ? travel.days[selectedIndex + 1]
    : undefined

  return (
    <nav className="adjacent-day-controls" aria-label="Journée précédente et suivante">
      <button
        className="secondary-button"
        type="button"
        disabled={!previous}
        aria-label={previous ? `Journée précédente : ${previous.title}` : 'Aucune journée précédente'}
        onClick={() => previous && onNavigate({ kind: 'day', dayId: previous.id })}
      >
        <ChevronLeftIcon />
        Précédent
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={!next}
        aria-label={next ? `Journée suivante : ${next.title}` : 'Aucune journée suivante'}
        onClick={() => next && onNavigate({ kind: 'day', dayId: next.id })}
      >
        Suivant
        <ChevronRightIcon />
      </button>
    </nav>
  )
}

/** Mène depuis l’étape ou la journée vers l’alternative regroupée dans Plans B. */
function PlanBHint({
  variants,
  context,
}: {
  variants: readonly TravelVariant[]
  context: string
}) {
  const [first] = variants
  if (!first) return null
  return (
    <button
      className="plan-b-hint"
      type="button"
      aria-label={`Voir le plan B prévu pour ${context}`}
      onClick={() => {
        const target = document.getElementById(planBElementId(first.id))
        target?.scrollIntoView?.({ block: 'center' })
        target?.focus()
      }}
    >
      <SwapIcon size={18} />
      <span>
        <strong>Plan B</strong> prévu{variants.length > 1 ? ` · ${variants.length} options` : ''}
      </span>
      <span className="plan-b-hint-action" aria-hidden="true">Voir</span>
    </button>
  )
}

const STEP_PROGRESS_BADGES: Partial<Record<StepProgress, string>> = {
  current: 'En cours',
  next: 'Prochaine étape',
}

/** Résume ce que la page de l’étape détaille, sans le recopier dans la frise. */
function StepDetailsHint({
  stepTitle,
  pieceCount,
  checklist,
  onOpen,
}: {
  stepTitle: string
  pieceCount: number
  checklist?: { readonly checked: number; readonly total: number }
  onOpen(): void
}) {
  const visible: string[] = []
  const spoken: string[] = []
  if (pieceCount > 0) {
    const pieces = pieceCount > 1 ? `${pieceCount} pièces` : '1 pièce'
    visible.push(pieces)
    spoken.push(pieces)
  }
  if (checklist) {
    visible.push(`Checklist ${checklist.checked}/${checklist.total}`)
    spoken.push(`checklist, ${checklist.checked} sur ${checklist.total} cochés`)
  }
  if (visible.length === 0) return null
  const HintIcon = pieceCount > 0 ? PaperclipIcon : ChecklistIcon
  return (
    <button
      className="step-details-hint"
      type="button"
      aria-label={`Voir le détail de l’étape ${stepTitle} : ${spoken.join(', ')}`}
      onClick={onOpen}
    >
      <HintIcon size={18} />
      <span>{visible.join(' · ')}</span>
      <span className="step-details-hint-action" aria-hidden="true">Voir</span>
    </button>
  )
}

/**
 * Frise de la journée : chaque étape garde au point d’usage son repère, sa
 * description, ses images et ses liens ; ses pièces, sa checklist et son
 * hébergement sont résumés et détaillés dans la page de l’étape.
 */
function Timeline({
  travel,
  day,
  progress,
  pieces,
  checkedItemKeys,
  onNavigate,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  progress?: readonly StepProgress[]
  pieces: readonly TravelPiece[]
  checkedItemKeys: ReadonlySet<string>
  onNavigate(view: TravelView): void
} & ActionProps) {
  return (
    <section className="timeline-section" aria-labelledby={`timeline-${day.id}`}>
      <h3 id={`timeline-${day.id}`}>Déroulé</h3>
      {day.steps.length === 0 ? (
        <p className="empty-state">Aucune étape n’est renseignée pour cette journée.</p>
      ) : (
        <ol className="timeline">
          {day.steps.map((step, index) => {
            const place = findPlace(travel, step.placeId)
            const contextualLinks = uniqueContextualLinks(step.links, place?.links)
            const hasLocalIllustration = step.illustrationIds.some(
              (illustrationId) => illustrationById(travel, illustrationId),
            )
            const illustrationLink = hasLocalIllustration
              ? stepIllustrationLink(step.links, place?.links)
              : undefined
            const remainingLinks = linksNotCarriedByIllustration(
              contextualLinks,
              illustrationLink,
            )
            const pieceCount = pieces.filter((piece) => piece.attachments.some(
              (attachment) => attachment.type === 'step' && attachment.step.id === step.id,
            )).length
            const stepVariants = travel.variants.filter(
              (variant) => variant.kind !== 'standard'
                && variant.target.type === 'step'
                && variant.target.stepId === step.id,
            )
            const stepState = progress?.[index] ?? 'upcoming'
            const badge = STEP_PROGRESS_BADGES[stepState]
            const openStep = () => onNavigate({ kind: 'step', stepId: step.id })
            return (
              <li key={step.id} className={`timeline-step timeline-step-${stepState}`}>
                <span className="timeline-dot" aria-hidden="true">
                  {stepState === 'done' && <CheckIcon size={14} />}
                </span>
                <article className="step-content" aria-labelledby={`step-${step.id}`}>
                  {badge && <p className="step-badge">{badge}</p>}
                  {stepState === 'done' && <p className="visually-hidden">Étape passée</p>}
                  <div className="step-heading">
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
                    <h4 id={`step-${step.id}`}>{step.title}</h4>
                    {place && (
                      <p className="step-place">
                        <MapPinIcon size={16} />
                        <span className="visually-hidden">Lieu : </span>
                        <span>{place.label}</span>
                      </p>
                    )}
                    <button
                      className="step-open-button"
                      type="button"
                      aria-label={`Ouvrir l’étape ${step.title}`}
                      onClick={openStep}
                    >
                      <ChevronRightIcon size={20} />
                    </button>
                  </div>
                  {step.description && <p className="step-description">{step.description}</p>}
                  <IllustrationCollection
                    travel={travel}
                    illustrationIds={step.illustrationIds}
                    practicalLink={illustrationLink}
                    practicalLinkContext={step.title}
                    online={actions.online}
                    onLoadResource={actions.onLoadIllustrationResource}
                  />
                  <ContextualLinkList
                    links={remainingLinks}
                    online={actions.online}
                    context={step.title}
                  />
                  <PlanBHint variants={stepVariants} context={step.title} />
                  <StepDetailsHint
                    stepTitle={step.title}
                    pieceCount={pieceCount}
                    checklist={checklistProgress(stepChecklists(travel, step.id), checkedItemKeys)}
                    onOpen={openStep}
                  />
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function PlansB({
  travel,
  day,
}: {
  travel: Travel
  day: TravelDay
}) {
  const variants = dayVariants(travel, day)
  if (variants.length === 0) return null

  return (
    <section className="plans-b" aria-labelledby={`plans-b-${day.id}`}>
      <h3 id={`plans-b-${day.id}`}>Plans B</h3>
      <ul>
        {variants.map((variant) => {
          const { target } = variant
          const targetStep = target.type === 'step'
            ? day.steps.find((step) => step.id === target.stepId)
            : undefined
          return (
            <li key={variant.id} id={planBElementId(variant.id)} tabIndex={-1}>
              <p className="plan-b-kind">
                <SwapIcon size={16} />
                {VARIANT_LABELS[variant.kind]}
              </p>
              <strong>{variant.label}</strong>
              <p>{variant.description}</p>
              <p className="plan-b-target">
                {targetStep ? `Remplace ou complète : ${targetStep.title}` : 'Pour toute la journée'}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DayComplements({
  travel,
  day,
  personalState,
}: {
  travel: Travel
  day: TravelDay
  personalState: PersonalStateProps
}) {
  const dayChecklists = travel.checklists.filter(
    (checklist) => checklist.target.type === 'day'
      && checklist.target.dayId === day.id,
  )
  const hasVariants = dayVariants(travel, day).length > 0

  // Les documents et réservations de la journée sont présentés une seule fois,
  // dans la bande « Pièces du jour ».
  if (dayChecklists.length === 0 && !hasVariants) return null

  return (
    <aside className="day-sidebar" aria-label="Compléments de la journée">
      <PlansB travel={travel} day={day} />
      {dayChecklists.length > 0 && (
        <section aria-labelledby={`day-checklists-${day.id}`}>
          <h3 id={`day-checklists-${day.id}`}>Checklist de la journée</h3>
          <ChecklistCollection checklists={dayChecklists} {...personalState} />
        </section>
      )}
    </aside>
  )
}

/** Hébergement de la date, rappelé comme repère sans répéter sa fiche. */
function DayAnchor({
  travel,
  day,
  onCopyAddress,
}: {
  travel: Travel
  day: TravelDay
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
}) {
  const anchor = findAccommodationForDate(travel, day.date)
  if (!anchor) return null
  const { accommodation, place } = anchor
  const arrival = accommodation.period.start === day.date

  return (
    <div className="day-anchor">
      <HomeIcon size={20} className="day-anchor-icon" />
      <p className="day-anchor-text">
        {arrival ? 'Hébergement' : 'Départ'} : <strong>{accommodation.label}</strong>
      </p>
      {place?.address && (
        <CopyAddressButton
          address={place.address}
          placeLabel={place.label}
          targetLabel={accommodation.label}
          iconOnly
          onCopyAddress={onCopyAddress}
        />
      )}
    </div>
  )
}

function DayDetail({
  travel,
  day,
  isToday,
  progress,
  personalState,
  userPieces,
  onNavigate,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  isToday: boolean
  progress?: readonly StepProgress[]
  personalState: PersonalStateProps
  userPieces: readonly UserPieceMetadata[]
  onNavigate(view: TravelView): void
} & ActionProps) {
  const dayLevelVariants = travel.variants.filter(
    (variant) => variant.kind !== 'standard'
      && variant.target.type === 'day'
      && variant.target.dayId === day.id,
  )
  const pieces = listTravelPieces(travel, userPieces)

  return (
    <div className="program-layout">
      <div className="program-main">
        <header className="day-header">
          <div className="day-heading-meta">
            {isToday && (
              <span className="status-pill status-pill-terracotta">
                <ClockIcon size={15} />
                Aujourd’hui sur place
              </span>
            )}
            <p className="day-heading-date">
              <time dateTime={day.date}>{capitalize(formatDate(day.date, travel.locale))}</time>
            </p>
          </div>
          <h2 id="day-title" className="day-title">{day.title}</h2>
          {day.summary && <p className="day-summary">{day.summary}</p>}
          <DayAnchor travel={travel} day={day} onCopyAddress={actions.onCopyAddress} />
          <PlanBHint variants={dayLevelVariants} context="cette journée" />
          <IllustrationCollection
            travel={travel}
            illustrationIds={day.illustrationIds}
            limit={1}
            cover
            onLoadResource={actions.onLoadIllustrationResource}
          />
        </header>
        <DayPieces travel={travel} day={day} pieces={pieces} onNavigate={onNavigate} />
        <Timeline
          travel={travel}
          day={day}
          progress={progress}
          pieces={pieces}
          checkedItemKeys={personalState.checkedItemKeys}
          onNavigate={onNavigate}
          {...actions}
        />
        <AdjacentDayControls travel={travel} selectedDayId={day.id} onNavigate={onNavigate} />
      </div>
      <DayComplements
        travel={travel}
        day={day}
        personalState={personalState}
      />
    </div>
  )
}

export function ProgramView({
  travel,
  view,
  clock,
  personalState,
  userPieces,
  onNavigate,
  ...actions
}: {
  travel: Travel
  view: Extract<TravelView, { kind: 'day' | 'today' }>
  clock: Clock
  personalState: PersonalStateProps
  userPieces: readonly UserPieceMetadata[]
  onNavigate(view: TravelView): void
} & ActionProps) {
  const today = getTodayState(travel, clock)
  const todayDayId = today.status === 'day' ? today.day.id : undefined
  // La vue `today` n’arrive ici que pour une date sans journée prévue.
  const day = view.kind === 'day'
    ? travel.days.find((candidate) => candidate.id === view.dayId)
    : undefined
  const isToday = Boolean(day && day.id === todayDayId)
  const [, setMinuteTick] = useState(0)

  // La progression du jour suit l’heure tant que la journée reste affichée.
  useEffect(() => {
    if (!isToday) return
    const timer = window.setInterval(() => setMinuteTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [isToday])

  const progress = day && isToday
    ? stepProgress(day.steps, localTimeInTimeZone(clock.now(), travel.timeZone))
    : undefined

  let statusMessage: string | undefined
  if (view.kind === 'today' && today.status !== 'day') {
    statusMessage = today.status === 'before'
      ? `Ce voyage n’a pas encore commencé. Il débute le ${formatDate(travel.period.start, travel.locale)}.`
      : today.status === 'after'
        ? `Ce voyage est terminé depuis le ${formatDate(travel.period.end, travel.locale)}.`
        : `Aucune journée n’est prévue pour le ${formatDate(today.date, travel.locale)}, bien que cette date soit comprise dans le séjour.`
  }

  return (
    <div className="consultation-view program-view" aria-labelledby="program-title">
      <h2 id="program-title" className="visually-hidden">Programme</h2>
      {travel.days.length === 0 ? (
        <p className="empty-state">Ce voyage ne contient aucune journée.</p>
      ) : (
        <>
          <DaySelector
            travel={travel}
            selectedDayId={day?.id}
            todayDayId={todayDayId}
            onNavigate={onNavigate}
          />
          {statusMessage && (
            <p className="empty-state today-status" role="status">{statusMessage}</p>
          )}
          {day && (
            <DayDetail
              travel={travel}
              day={day}
              isToday={isToday}
              progress={progress}
              personalState={personalState}
              userPieces={userPieces}
              onNavigate={onNavigate}
              {...actions}
            />
          )}
        </>
      )}
    </div>
  )
}
