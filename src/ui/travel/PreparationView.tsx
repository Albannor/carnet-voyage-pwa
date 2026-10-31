import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { Travel, TravelDocument } from '../../domain/voyage/model'
import { MAX_TRAVEL_NOTE_LENGTH } from '../../persistence/model'
import { formatCompactDate } from '../travelDates'
import { ChecklistCollection, ReservationDetails } from './ConsultationActions'
import { pendingReservation } from './consultationHelpers'
import type { PersonalSaveResult, PersonalStateProps } from './consultationTypes'

function NotesPanel({
  initialNote,
  saveDelayMs,
  onSave,
}: {
  initialNote: string
  saveDelayMs: number
  onSave(text: string): Promise<PersonalSaveResult>
}) {
  const [note, setNote] = useState(initialNote)
  const [status, setStatus] = useState<'idle' | 'editing' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const revision = useRef(0)
  const requestedRevision = useRef(0)
  const latestNote = useRef(initialNote)
  const saveRef = useRef(onSave)

  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  async function save(value: string, currentRevision: number) {
    window.clearTimeout(timer.current)
    setStatus('saving')
    requestedRevision.current = Math.max(requestedRevision.current, currentRevision)
    const result = await onSave(value)
    if (revision.current !== currentRevision) return
    setStatus(result.ok ? 'saved' : 'error')
  }

  function scheduleSave(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.currentTarget.value
    const currentRevision = revision.current + 1
    revision.current = currentRevision
    latestNote.current = value
    setNote(value)
    setStatus('editing')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void save(value, currentRevision)
    }, saveDelayMs)
  }

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (revision.current > requestedRevision.current) {
      void saveRef.current(latestNote.current)
    }
  }, [])

  return (
    <section className="personal-notes" aria-labelledby="personal-notes-title">
      <p className="card-label">Données personnelles</p>
      <h2 id="personal-notes-title">Notes personnelles</h2>
      <label htmlFor="travel-personal-note">Note générale du voyage</label>
      <textarea
        id="travel-personal-note"
        value={note}
        maxLength={MAX_TRAVEL_NOTE_LENGTH}
        rows={6}
        onChange={scheduleSave}
        onBlur={() => {
          if (status === 'editing') void save(note, revision.current)
        }}
      />
      <div className="note-meta">
        <span>Texte brut · reste uniquement sur cet appareil.</span>
        <span role={status === 'error' ? 'alert' : 'status'} aria-live="polite">
          {status === 'editing' && 'Modification en cours…'}
          {status === 'saving' && 'Enregistrement local…'}
          {status === 'saved' && 'Enregistré localement'}
          {status === 'error' && 'Échec de l’enregistrement. Votre texte reste affiché pour permettre une nouvelle tentative.'}
        </span>
      </div>
    </section>
  )
}

export function PreparationView({
  travel,
  personalState,
  online,
  onOpenDocument,
  initialNote,
  noteSaveDelayMs,
  onSaveNote,
}: {
  travel: Travel
  personalState: PersonalStateProps
  online: boolean
  onOpenDocument(document: TravelDocument): void
  initialNote: string
  noteSaveDelayMs: number
  onSaveNote(text: string): Promise<PersonalSaveResult>
}) {
  const travelChecklists = travel.checklists.filter(
    (checklist) => checklist.target.type === 'travel',
  )
  const dayGroups = travel.days.flatMap((day) => {
    const dayChecklists = travel.checklists.filter(
      (checklist) => checklist.target.type === 'day'
        && checklist.target.dayId === day.id,
    )
    const steps = day.steps.flatMap((step) => {
      const checklists = travel.checklists.filter(
        (checklist) => checklist.target.type === 'step'
          && checklist.target.stepId === step.id,
      )
      return checklists.length > 0 ? [{ step, checklists }] : []
    })
    return dayChecklists.length > 0 || steps.length > 0
      ? [{ day, dayChecklists, steps }]
      : []
  })
  const pendingReservations = travel.reservations.filter(pendingReservation)

  return (
    <div className="consultation-view preparation-view" aria-labelledby="preparation-title">
      <header className="section-heading">
        <p className="section-label">Préparation</p>
        <h2 id="preparation-title">À préparer et à confirmer</h2>
      </header>
      {travelChecklists.length > 0 && (
        <section className="preparation-group" aria-labelledby="travel-checklists-title">
          <h3 id="travel-checklists-title">Pour le voyage</h3>
          <ChecklistCollection checklists={travelChecklists} {...personalState} />
        </section>
      )}
      {dayGroups.length > 0 && (
        <section className="preparation-group" aria-labelledby="targeted-checklists-title">
          <h3 id="targeted-checklists-title">Par journée et étape</h3>
          <div className="preparation-day-list">
            {dayGroups.map(({ day, dayChecklists, steps }) => (
              <article className="preparation-day" key={day.id}>
                <header>
                  <time dateTime={day.date}>{formatCompactDate(day.date, travel.locale)}</time>
                  <h4>{day.title}</h4>
                </header>
                <ChecklistCollection checklists={dayChecklists} {...personalState} />
                {steps.map(({ step, checklists }) => (
                  <section className="preparation-step" key={step.id}>
                    <h5>{step.title}</h5>
                    <ChecklistCollection checklists={checklists} {...personalState} />
                  </section>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
      {pendingReservations.length > 0 && (
        <section className="preparation-group" aria-labelledby="pending-reservations-title">
          <h3 id="pending-reservations-title">À confirmer</h3>
          <div className="practical-card-grid">
            {pendingReservations.map((reservation) => (
              <ReservationDetails
                key={reservation.id}
                travel={travel}
                reservation={reservation}
                online={online}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        </section>
      )}
      {travel.checklists.length === 0 && pendingReservations.length === 0 && (
        <p className="empty-state">Aucune préparation structurée n’est associée à ce voyage.</p>
      )}
      <NotesPanel
        initialNote={initialNote}
        saveDelayMs={noteSaveDelayMs}
        onSave={onSaveNote}
      />
    </div>
  )
}
