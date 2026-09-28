import { Link, useParams } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { QueryState } from '../components/QueryState'
import { usePlayerAttendance } from '../features/attendance/api'
import { AttendanceHistory } from '../features/attendance/AttendanceHistory'
import { useAddNote, useNotes, useUpdateNote } from '../features/notes/api'
import { NoteForm } from '../features/notes/NoteForm'
import { NoteList } from '../features/notes/NoteList'
import { useProgram, useRoster } from '../features/programs/api'

/** A player as their coach sees them in one program: attendance and development notes. */
export function CoachPlayerPage() {
  const { programId = '', playerId = '' } = useParams()
  const { user } = useAuth()
  const program = useProgram(programId)
  const roster = useRoster(programId)
  const attendance = usePlayerAttendance(playerId, programId)
  const notes = useNotes(playerId, programId)
  const addNote = useAddNote(playerId)
  const updateNote = useUpdateNote()

  const enrolment = roster.data?.find((e) => e.player_id === playerId)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {program.data && (
        <Link to={`/coach/programs/${programId}`} className="text-sm text-emerald-700 hover:underline">
          ← {program.data.name}
        </Link>
      )}
      <QueryState isPending={roster.isPending} error={roster.error} />
      {roster.data && !enrolment && <p className="text-slate-600">This player isn’t in this program.</p>}

      {enrolment && (
        <>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{enrolment.first_name} {enrolment.last_name}</h1>
            {enrolment.status === 'INACTIVE' && <p className="text-slate-600">No longer active in this program</p>}
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Attendance</h2>
            <QueryState isPending={attendance.isPending} error={attendance.error} />
            {attendance.data && <AttendanceHistory attendance={attendance.data} showProgram={false} />}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Development notes</h2>
            <QueryState isPending={notes.isPending} error={notes.error} />
            {notes.data && user && (
              <NoteList
                notes={notes.data}
                showProgram={false}
                editor={{
                  coachId: user.id,
                  onUpdate: (noteId, data) => updateNote.mutateAsync({ noteId, data }),
                }}
              />
            )}
          </section>

          {enrolment.status === 'ACTIVE' && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Add a note</h2>
              <NoteForm
                submitLabel="Add note"
                onSubmit={(data) => addNote.mutateAsync({ ...data, program_id: programId })}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
