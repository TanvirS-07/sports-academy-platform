import { useState } from 'react'
import { useParams } from 'react-router'

import { Button, ButtonLink } from '../components/Button'
import { ConfirmAction } from '../components/Confirm'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, PanelBody, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { SessionRow } from '../components/SessionRow'
import { Tag } from '../components/Tag'
import { useToast } from '../components/Toast'
import { usePlayerAttendance } from '../features/attendance/api'
import { AttendanceHistory } from '../features/attendance/AttendanceHistory'
import { useBookings, useCancelBooking, type Booking } from '../features/bookings/api'
import { useNotes } from '../features/notes/api'
import { NoteList } from '../features/notes/NoteList'
import { usePlayer, useUpdatePlayer } from '../features/players/api'
import { PlayerForm } from '../features/players/PlayerForm'
import { formatDate } from '../lib/dates'
import { formatDay } from '../lib/sydneyTime'

/** Hides an old cancelled booking when the child has booked the same session again. */
function withoutRebooked(bookings: Booking[]): Booking[] {
  const confirmed = new Set(bookings.filter((b) => b.status === 'CONFIRMED').map((b) => b.session.id))
  return bookings.filter((b) => b.status === 'CONFIRMED' || !confirmed.has(b.session.id))
}

export function PlayerPage() {
  const { playerId = '' } = useParams()
  const player = usePlayer(playerId)
  const updatePlayer = useUpdatePlayer(playerId)
  const bookings = useBookings(playerId)
  const cancel = useCancelBooking()
  const attendance = usePlayerAttendance(playerId)
  const notes = useNotes(playerId)
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  const shown = withoutRebooked(bookings.data ?? [])
  const confirmedCount = shown.filter((booking) => booking.status === 'CONFIRMED').length

  return (
    <>
      <QueryState isPending={player.isPending} error={player.error} />

      {player.data && (
        <>
          <PageHeader
            back={{ label: 'Home', to: '/parent' }}
            title={`${player.data.first_name} ${player.data.last_name}`}
            description={`Born ${formatDate(player.data.date_of_birth)}`}
            actions={!editing && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          />

          {editing && (
            <Panel title="Edit details" id="edit-player" className="mb-8 max-w-2xl">
              <PanelBody className="py-5">
                <PlayerForm
                  initial={player.data}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(false)}
                  onSubmit={async (data) => {
                    await updatePlayer.mutateAsync(data)
                    setEditing(false)
                    toast('Details saved.')
                  }}
                />
              </PanelBody>
            </Panel>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
            <div className="min-w-0 space-y-6 lg:space-y-8">
              <Panel
                title="Upcoming bookings"
                id="bookings"
                action={confirmedCount > 0 && <ButtonLink to="/parent/sessions" variant="secondary" size="sm">Book more</ButtonLink>}
              >
                <QueryState isPending={bookings.isPending} error={bookings.error ?? cancel.error} />
                {bookings.data && confirmedCount === 0 && (
                  <EmptyState
                    action={
                      player.data.programs.length > 0 && (
                        <ButtonLink to="/parent/sessions" variant="secondary">See sessions</ButtonLink>
                      )
                    }
                  >
                    No upcoming bookings.
                  </EmptyState>
                )}
                <RowList>
                  {shown.map((booking) => {
                    const confirmed = booking.status === 'CONFIRMED'
                    return (
                      <SessionRow
                        key={booking.id}
                        startsAt={booking.session.starts_at}
                        endsAt={booking.session.ends_at}
                        muted={!confirmed}
                        detail={`${booking.session.program.name} · ${booking.session.location}`}
                        aside={
                          confirmed ? (
                            <ConfirmAction
                              label="Cancel booking"
                              ariaLabel={`Cancel booking for ${formatDay(booking.session.starts_at)}`}
                              question={`Cancel ${player.data?.first_name}’s place?`}
                              confirmLabel="Cancel booking"
                              busy={cancel.isPending}
                              onConfirm={() =>
                                cancel.mutate(booking.id, {
                                  onSuccess: () => toast(`Booking for ${formatDay(booking.session.starts_at)} cancelled.`),
                                })
                              }
                            />
                          ) : (
                            <Tag tone="danger">
                              {booking.session.status === 'CANCELLED' ? 'Session cancelled' : 'Cancelled'}
                            </Tag>
                          )
                        }
                      />
                    )
                  })}
                </RowList>
              </Panel>

              <Panel title="Development notes" id="notes">
                <QueryState isPending={notes.isPending} error={notes.error} />
                {notes.data && <NoteList notes={notes.data} showProgram />}
              </Panel>
            </div>

            <div className="space-y-6 lg:space-y-8">
              <Panel title="Programs" id="programs">
                {player.data.programs.length === 0 ? (
                  <EmptyState>Not enrolled in a program yet. Their coach will add them.</EmptyState>
                ) : (
                  <RowList>
                    {player.data.programs.map((program) => (
                      <li key={program.id} className="px-4 py-3.5 sm:px-5">
                        <p className="font-semibold">{program.name}</p>
                        <p className="mt-0.5 text-sm text-ink-muted">
                          {program.sport} · {program.age_group} · Coach {program.coach_name}
                        </p>
                      </li>
                    ))}
                  </RowList>
                )}
              </Panel>

              <Panel title="Attendance" id="attendance">
                <QueryState isPending={attendance.isPending} error={attendance.error} />
                {attendance.data && <AttendanceHistory attendance={attendance.data} showProgram />}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}
