import { EmptyState, RowList } from '../../components/Panel'
import { SessionRow } from '../../components/SessionRow'
import { Tag, type Tone } from '../../components/Tag'
import { attendanceLabels, type AttendanceStatus, type PlayerAttendance } from './api'

const tones: Record<AttendanceStatus, Tone> = {
  PRESENT: 'success',
  ABSENT: 'neutral',
  EXCUSED: 'info',
}

/** The attendance summary and the sessions it's made of, newest first. */
export function AttendanceHistory({ attendance, showProgram }: { attendance: PlayerAttendance; showProgram: boolean }) {
  const { summary, records } = attendance
  if (summary.total === 0) return <EmptyState>No attendance recorded yet.</EmptyState>

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-2xl font-bold tabular-nums">
          {Math.round((summary.present / summary.total) * 100)}%
        </p>
        <p className="text-sm">
          <span className="block font-semibold">
            Attended {summary.present} of {summary.total} {summary.total === 1 ? 'session' : 'sessions'}
          </span>
          <span className="block text-ink-muted">{summary.absent} absent, {summary.excused} excused</span>
        </p>
      </div>
      <RowList>
        {records.map((record) => (
          <SessionRow
            key={record.session.id}
            startsAt={record.session.starts_at}
            endsAt={record.session.ends_at}
            detail={showProgram ? `${record.session.program.name} · ${record.session.location}` : record.session.location}
            aside={<Tag tone={tones[record.status]}>{attendanceLabels[record.status]}</Tag>}
          />
        ))}
      </RowList>
    </>
  )
}
