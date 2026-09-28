import { formatSessionTime } from '../../lib/sydneyTime'
import { attendanceLabels, type PlayerAttendance } from './api'

const statusClasses = {
  PRESENT: 'text-emerald-800',
  ABSENT: 'text-red-700',
  EXCUSED: 'text-slate-600',
}

/** The attendance summary and the sessions it's made of, newest first. */
export function AttendanceHistory({ attendance, showProgram }: { attendance: PlayerAttendance; showProgram: boolean }) {
  const { summary, records } = attendance
  if (summary.total === 0) return <p className="text-slate-600">No attendance recorded yet.</p>

  return (
    <div className="space-y-3">
      <p>
        <span className="font-medium">Attended {summary.present} of {summary.total} sessions</span>
        <span className="text-slate-600"> · {summary.absent} absent, {summary.excused} excused</span>
      </p>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {records.map((record) => (
          <li key={record.session.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{formatSessionTime(record.session.starts_at, record.session.ends_at)}</p>
              <p className="text-sm text-slate-500">
                {showProgram && `${record.session.program.name} · `}{record.session.location}
              </p>
            </div>
            <span className={`text-sm font-medium ${statusClasses[record.status]}`}>
              {attendanceLabels[record.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
