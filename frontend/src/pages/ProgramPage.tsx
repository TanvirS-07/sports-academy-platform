import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Button, ButtonLink, TextButton } from '../components/Button'
import { ConfirmAction } from '../components/Confirm'
import { Notice } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, PanelBody, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { SessionRow } from '../components/SessionRow'
import { Tag } from '../components/Tag'
import { useToast } from '../components/Toast'
import { useProgram, useRoster, useSetEnrolmentStatus, useUpdateProgram } from '../features/programs/api'
import { EnrolPlayer } from '../features/programs/EnrolPlayer'
import { ProgramForm } from '../features/programs/ProgramForm'
import { useSessions, type TrainingSession } from '../features/sessions/api'
import { SessionPlaces } from '../features/sessions/SessionPlaces'
import { ageOn, formatDate } from '../lib/dates'
import { errorMessage } from '../lib/errors'

export function ProgramPage() {
  const { programId = '' } = useParams()
  const program = useProgram(programId)
  const roster = useRoster(programId)
  const sessions = useSessions(programId, { includePast: true })
  const updateProgram = useUpdateProgram(programId)
  const setStatus = useSetEnrolmentStatus(programId)
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  // The API returns them oldest first. Past ones are shown newest first, for attendance.
  const now = new Date()
  const upcoming = sessions.data?.filter((session) => new Date(session.ends_at) > now)
  const past = sessions.data?.filter((session) => new Date(session.ends_at) <= now).reverse().slice(0, 10)
  const activeCount = roster.data?.filter((enrolment) => enrolment.status === 'ACTIVE').length

  function changeStatus(playerId: string, name: string, status: 'ACTIVE' | 'INACTIVE') {
    setStatus.mutate(
      { playerId, status },
      { onSuccess: () => toast(status === 'ACTIVE' ? `${name} is active again.` : `${name} is now inactive.`) },
    )
  }

  return (
    <>
      <QueryState isPending={program.isPending} error={program.error} />

      {program.data && (
        <>
          <PageHeader
            back={{ label: 'Programs', to: '/coach' }}
            title={program.data.name}
            description={
              <>
                {program.data.age_group}
                {activeCount !== undefined && ` · ${activeCount} active ${activeCount === 1 ? 'player' : 'players'}`}
              </>
            }
            actions={
              !editing && (
                <>
                  <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
                  <ButtonLink to={`/coach/programs/${programId}/sessions/new`}>New session</ButtonLink>
                </>
              )
            }
          />

          {editing && (
            <Panel title="Edit program" id="edit-program" className="mb-8 max-w-2xl">
              <PanelBody className="py-5">
                <ProgramForm
                  initial={{
                    name: program.data.name,
                    sport_id: program.data.sport.id,
                    age_group: program.data.age_group,
                    description: program.data.description,
                    objectives: program.data.objectives,
                  }}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(false)}
                  onSubmit={async (data) => {
                    await updateProgram.mutateAsync(data)
                    setEditing(false)
                    toast('Program saved.')
                  }}
                />
              </PanelBody>
            </Panel>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
            <div className="min-w-0 space-y-6 lg:space-y-8">
              <Panel title="Upcoming sessions" id="upcoming">
                <QueryState isPending={sessions.isPending} error={sessions.error} />
                {upcoming?.length === 0 && (
                  <EmptyState
                    action={
                      <ButtonLink to={`/coach/programs/${programId}/sessions/new`} variant="secondary">
                        Add a session
                      </ButtonLink>
                    }
                  >
                    No upcoming sessions. Add one so parents can book.
                  </EmptyState>
                )}
                <SessionLinks sessions={upcoming ?? []} />
              </Panel>

              <Panel title="Players" id="players">
                <EnrolPlayer programId={programId} roster={roster.data ?? []} />
                <QueryState isPending={roster.isPending} error={roster.error} />
                {setStatus.error && (
                  <div className="px-4 pt-4 sm:px-5">
                    <Notice tone="danger">{errorMessage(setStatus.error)}</Notice>
                  </div>
                )}
                {roster.data?.length === 0 && (
                  <EmptyState>No players yet. Find a player above to enrol them.</EmptyState>
                )}
                {roster.data && roster.data.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-line bg-subtle/60 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Player</th>
                          <th scope="col" className="px-3 py-2.5 font-semibold">Age</th>
                          <th scope="col" className="hidden px-3 py-2.5 font-semibold sm:table-cell">Date of birth</th>
                          <th scope="col" className="px-4 py-2.5 sm:px-5"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {roster.data.map((enrolment) => {
                          const active = enrolment.status === 'ACTIVE'
                          const name = `${enrolment.first_name} ${enrolment.last_name}`
                          return (
                            <tr key={enrolment.player_id} className="group">
                              <td className="px-4 py-3 sm:px-5">
                                <span className="flex items-center gap-2 whitespace-nowrap">
                                  <Link
                                    to={`/coach/programs/${programId}/players/${enrolment.player_id}`}
                                    className={`font-semibold underline-offset-4 hover:underline ${active ? '' : 'text-ink-muted'}`}
                                  >
                                    {name}
                                  </Link>
                                  {!active && <Tag>Inactive</Tag>}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-ink-muted tabular-nums">
                                {enrolment.date_of_birth ? ageOn(enrolment.date_of_birth) : '–'}
                              </td>
                              <td className="hidden px-3 py-3 whitespace-nowrap text-ink-muted tabular-nums sm:table-cell">
                                {enrolment.date_of_birth ? formatDate(enrolment.date_of_birth) : '–'}
                              </td>
                              <td className="px-4 py-3 text-right sm:px-5">
                                <div className="transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                                  {active ? (
                                    <ConfirmAction
                                      label="Make inactive"
                                      ariaLabel={`Make inactive: ${name}`}
                                      question={`Make ${enrolment.first_name} inactive? Their upcoming bookings are cancelled.`}
                                      confirmLabel="Make inactive"
                                      busy={setStatus.isPending}
                                      onConfirm={() => changeStatus(enrolment.player_id, name, 'INACTIVE')}
                                    />
                                  ) : (
                                    <TextButton
                                      disabled={setStatus.isPending}
                                      aria-label={`Make active: ${name}`}
                                      onClick={() => changeStatus(enrolment.player_id, name, 'ACTIVE')}
                                    >
                                      Make active
                                    </TextButton>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>

            <div className="space-y-6 lg:space-y-8">
              {(program.data.description || program.data.objectives) && (
                <Panel title="About this program" id="about">
                  <PanelBody className="space-y-4 text-[15px] leading-7">
                    {program.data.description && <p className="whitespace-pre-line">{program.data.description}</p>}
                    {program.data.objectives && (
                      <div>
                        <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
                          Training objectives
                        </h3>
                        <p className="mt-1 whitespace-pre-line">{program.data.objectives}</p>
                      </div>
                    )}
                  </PanelBody>
                </Panel>
              )}

              {past && past.length > 0 && (
                <Panel title="Past sessions" id="past">
                  <SessionLinks sessions={past} showPlaces={false} />
                </Panel>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function SessionLinks({ sessions, showPlaces = true }: { sessions: TrainingSession[]; showPlaces?: boolean }) {
  return (
    <RowList>
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          startsAt={session.starts_at}
          endsAt={session.ends_at}
          to={`/coach/sessions/${session.id}`}
          muted={session.status === 'CANCELLED'}
          detail={session.location}
          aside={showPlaces || session.status === 'CANCELLED' ? <SessionPlaces session={session} /> : undefined}
        />
      ))}
    </RowList>
  )
}
