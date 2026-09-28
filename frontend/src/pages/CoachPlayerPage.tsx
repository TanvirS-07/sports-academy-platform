import { useParams } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { PageHeader } from '../components/PageHeader'
import { Panel, PanelBody } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { Tag } from '../components/Tag'
import { useToast } from '../components/Toast'
import { usePlayerAttendance } from '../features/attendance/api'
import { AttendanceHistory } from '../features/attendance/AttendanceHistory'
import { useAddNote, useNotes, useUpdateNote } from '../features/notes/api'
import { NoteForm } from '../features/notes/NoteForm'
import { NoteList } from '../features/notes/NoteList'
import { useProgram, useRoster } from '../features/programs/api'
import { ageOn } from '../lib/dates'

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
  const toast = useToast()

  const enrolment = roster.data?.find((e) => e.player_id === playerId)
  const back = program.data ? { label: program.data.name, to: `/coach/programs/${programId}` } : undefined

  return (
    <>
      <QueryState isPending={roster.isPending} error={roster.error} />
      {roster.data && !enrolment && (
        <>
          <PageHeader back={back} title="Player not in this program" />
          <p className="text-ink-muted">This player isn’t in this program.</p>
        </>
      )}

      {enrolment && (
        <>
          <PageHeader
            back={back}
            title={`${enrolment.first_name} ${enrolment.last_name}`}
            description={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {enrolment.date_of_birth && <span>Age {ageOn(enrolment.date_of_birth)}</span>}
                {enrolment.date_of_birth && program.data && <span aria-hidden="true">·</span>}
                {program.data && <span>{program.data.name}</span>}
                {enrolment.status === 'INACTIVE' && <Tag>No longer active in this program</Tag>}
              </span>
            }
          />

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
            <div className="min-w-0 space-y-6 lg:space-y-8">
              <Panel title="Development notes" id="notes">
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
              </Panel>

              {enrolment.status === 'ACTIVE' && (
                <Panel title="Add a note" id="add-note">
                  <PanelBody className="py-5">
                    <p className="mb-5 text-sm text-ink-muted">
                      {enrolment.first_name}’s parents can read the notes you add here. Fill in any of the boxes.
                    </p>
                    <NoteForm
                      submitLabel="Add note"
                      onSubmit={async (data) => {
                        await addNote.mutateAsync({ ...data, program_id: programId })
                        toast('Note added.')
                      }}
                    />
                  </PanelBody>
                </Panel>
              )}
            </div>

            <Panel title="Attendance" id="attendance">
              <QueryState isPending={attendance.isPending} error={attendance.error} />
              {attendance.data && <AttendanceHistory attendance={attendance.data} showProgram={false} />}
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
