import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPut } from '../../lib/api'

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED'

export const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
}

export type SessionAttendanceRow = {
  player: { id: string; first_name: string; last_name: string }
  /** null until the coach marks it. */
  status: AttendanceStatus | null
}

export type AttendanceMark = { player_id: string; status: AttendanceStatus }

export type PlayerAttendanceRecord = {
  session: {
    id: string
    program: { id: string; name: string }
    starts_at: string
    ends_at: string
    location: string
  }
  status: AttendanceStatus
}

export type PlayerAttendance = {
  summary: { present: number; absent: number; excused: number; total: number }
  records: PlayerAttendanceRecord[]
}

const attendanceKey = ['attendance'] as const

/** The booked players of a session that has started, with their attendance. */
export function useSessionAttendance(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...attendanceKey, 'session', sessionId],
    queryFn: () => apiGet<SessionAttendanceRow[]>(`/sessions/${sessionId}/attendance`),
    enabled,
  })
}

export function useSaveAttendance(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (records: AttendanceMark[]) =>
      apiPut<SessionAttendanceRow[]>(`/sessions/${sessionId}/attendance`, { records }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceKey }),
  })
}

/** A player's attendance, newest first. Coaches only get their own programs back. */
export function usePlayerAttendance(playerId: string, programId?: string) {
  const query = programId ? `?program_id=${encodeURIComponent(programId)}` : ''
  return useQuery({
    queryKey: [...attendanceKey, 'player', playerId, programId ?? 'all'],
    queryFn: () => apiGet<PlayerAttendance>(`/players/${playerId}/attendance${query}`),
  })
}
