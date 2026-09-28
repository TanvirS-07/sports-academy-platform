import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { QueryState } from '../components/QueryState'
import { useProgram, useRoster, useSetEnrolmentStatus, useUpdateProgram } from '../features/programs/api'
import { EnrolPlayer } from '../features/programs/EnrolPlayer'
import { ProgramForm } from '../features/programs/ProgramForm'
import { useSessions } from '../features/sessions/api'
import { placesText } from '../features/sessions/places'
import { formatDate } from '../lib/dates'
import { errorMessage } from '../lib/errors'
import { formatSessionTime } from '../lib/sydneyTime'

export function ProgramPage() {
  const { programId = '' } = useParams()
  const program = useProgram(programId)
  const roster = useRoster(programId)
  const sessions = useSessions(programId)
  const updateProgram = useUpdateProgram(programId)
  const setStatus = useSetEnrolmentStatus(programId)
  const [editing, setEditing] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link to="/coach" className="text-sm text-emerald-700 hover:underline">← My programs</Link>
      <QueryState isPending={program.isPending} error={program.error} />

      {program.data && (
        <>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{program.data.name}</h1>
                <p className="text-slate-600">{program.data.sport.name} · {program.data.age_group}</p>
              </div>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)}
                  className="text-sm font-medium text-emerald-700 hover:underline">
                  Edit
                </button>
              )}
            </div>
            {editing ? (
              <ProgramForm
                initial={{
                  name: program.data.name,
                  sport_id: program.data.sport.id,
                  age_group: program.data.age_group,
                  description: program.data.description,
                  objectives: program.data.objectives,
                }}
                submitLabel="Save changes"
                onSubmit={async (data) => {
                  await updateProgram.mutateAsync(data)
                  setEditing(false)
                }}
              />
            ) : (
              <>
                {program.data.description && <p className="whitespace-pre-line">{program.data.description}</p>}
                {program.data.objectives && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">Training objectives</h2>
                    <p className="whitespace-pre-line">{program.data.objectives}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Upcoming sessions</h2>
              <Link to={`/coach/programs/${programId}/sessions/new`}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
                New session
              </Link>
            </div>
            <QueryState isPending={sessions.isPending} error={sessions.error} />
            {sessions.data?.length === 0 && <p className="text-slate-600">No upcoming sessions.</p>}
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {sessions.data?.map((session) => (
                <li key={session.id}>
                  <Link to={`/coach/sessions/${session.id}`} className="block px-4 py-3 hover:bg-slate-50">
                    <p className="font-medium">{formatSessionTime(session.starts_at, session.ends_at)}</p>
                    <p className="text-sm text-slate-500">{session.location} · {placesText(session)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Players</h2>
            <QueryState isPending={roster.isPending} error={roster.error} />
            {setStatus.error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {errorMessage(setStatus.error)}
              </p>
            )}
            {roster.data?.length === 0 && <p className="text-slate-600">No players enrolled yet.</p>}
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {roster.data?.map((enrolment) => {
                const active = enrolment.status === 'ACTIVE'
                const name = `${enrolment.first_name} ${enrolment.last_name}`
                return (
                  <li key={enrolment.player_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className={active ? 'font-medium' : 'font-medium text-slate-400'}>{name}</p>
                      <p className="text-sm text-slate-500">
                        {enrolment.date_of_birth ? `Born ${formatDate(enrolment.date_of_birth)}` : 'Inactive'}
                      </p>
                    </div>
                    <button type="button" disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate({ playerId: enrolment.player_id, status: active ? 'INACTIVE' : 'ACTIVE' })
                      }
                      aria-label={`${active ? 'Make inactive' : 'Make active'}: ${name}`}
                      className="text-sm font-medium text-emerald-700 hover:underline disabled:opacity-60">
                      {active ? 'Make inactive' : 'Make active'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <EnrolPlayer programId={programId} roster={roster.data ?? []} />
        </>
      )}
    </div>
  )
}
