import { useState } from 'react'
import { useParams } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmAction } from '../components/Confirm'
import { Notice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, PanelBody, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { Tag } from '../components/Tag'
import { useToast } from '../components/Toast'
import { useSaveAttendance, useSessionAttendance } from '../features/attendance/api'
import { AttendanceForm } from '../features/attendance/AttendanceForm'
import { useCancelBooking } from '../features/bookings/api'
import { useCancelSession, useSession, useSessionBookings, useUpdateSession } from '../features/sessions/api'
import { placesText } from '../features/sessions/places'
import { SessionForm } from '../features/sessions/SessionForm'
import { errorMessage } from '../lib/errors'
import { formatDay, formatTimeRange } from '../lib/sydneyTime'

export function CoachSessionPage() {
  const { sessionId = '' } = useParams()
  const session = useSession(sessionId)
  const bookings = useSessionBookings(sessionId)
  const updateSession = useUpdateSession(sessionId)
  const cancelSession = useCancelSession(sessionId)
  const cancelBooking = useCancelBooking()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  const actionError = cancelSession.error ?? cancelBooking.error
  const scheduled = session.data?.status === 'SCHEDULED'
  const upcoming = scheduled && new Date(session.data?.starts_at ?? 0) > new Date()
  // Attendance opens when the session starts. Bookings can't change after that.
  const started = scheduled && !upcoming
  const attendance = useSessionAttendance(sessionId, started)
  const saveAttendance = useSaveAttendance(sessionId)

  return (
    <>
      <QueryState isPending={session.isPending} error={session.error} />

      {session.data && (
        <>
          <PageHeader
            back={{ label: session.data.program.name, to: `/coach/programs/${session.data.program.id}` }}
            title={formatDay(session.data.starts_at)}
            tabTitle={`${formatDay(session.data.starts_at)} · ${session.data.program.name}`}
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-ink tabular-nums">
                  {formatTimeRange(session.data.starts_at, session.data.ends_at)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{session.data.location}</span>
                {scheduled && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{placesText(session.data)}</span>
                  </>
                )}
                {!scheduled && <Tag tone="danger">Cancelled</Tag>}
              </span>
            }
            actions={upcoming && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          />

          {editing && (
            <Panel title="Edit session" id="edit-session" className="mb-8 max-w-2xl">
              <PanelBody className="py-5">
                <SessionForm
                  initial={session.data}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(false)}
                  onSubmit={async (data) => {
                    await updateSession.mutateAsync(data)
                    setEditing(false)
                    toast('Session saved.')
                  }}
                />
              </PanelBody>
            </Panel>
          )}

          {actionError && (
            <div className="mb-6">
              <Notice tone="danger">{errorMessage(actionError)}</Notice>
            </div>
          )}

          <div className="max-w-3xl space-y-6">
            {started && (
              <Panel title="Attendance" id="attendance">
                <QueryState isPending={attendance.isPending} error={attendance.error} />
                {attendance.data?.length === 0 && <EmptyState>Nobody was booked into this session.</EmptyState>}
                {attendance.data && attendance.data.length > 0 && (
                  <AttendanceForm rows={attendance.data} onSave={(records) => saveAttendance.mutateAsync(records)} />
                )}
              </Panel>
            )}

            {!started && (
              <Panel title="Booked players" id="booked">
                <QueryState isPending={bookings.isPending} error={bookings.error} />
                {bookings.data?.length === 0 && <EmptyState>Nobody has booked yet.</EmptyState>}
                <RowList>
                  {bookings.data?.map((booking) => {
                    const name = `${booking.player.first_name} ${booking.player.last_name}`
                    return (
                      <li key={booking.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                        <span className="font-semibold">{name}</span>
                        {upcoming && (
                          <ConfirmAction
                            label="Cancel booking"
                            ariaLabel={`Cancel booking: ${name}`}
                            question={`Remove ${booking.player.first_name} from this session?`}
                            confirmLabel="Remove"
                            busy={cancelBooking.isPending}
                            onConfirm={() =>
                              cancelBooking.mutate(booking.id, { onSuccess: () => toast(`${name}’s booking was cancelled.`) })
                            }
                          />
                        )}
                      </li>
                    )
                  })}
                </RowList>
                {upcoming && (
                  <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted sm:px-5">
                    You can mark attendance once the session starts.
                  </p>
                )}
              </Panel>
            )}

            {upcoming && (
              <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="font-semibold">Cancel this session</p>
                  <p className="text-sm text-ink-muted">Every booking for it is cancelled too, and parents see it as cancelled.</p>
                </div>
                <ConfirmAction
                  label="Cancel session"
                  question="Cancel it for everyone?"
                  confirmLabel="Yes, cancel it"
                  busy={cancelSession.isPending}
                  onConfirm={() => cancelSession.mutate(undefined, { onSuccess: () => toast('Session cancelled.') })}
                />
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
