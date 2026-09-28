import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPatch, apiPost } from '../../lib/api'

export type SessionStatus = 'SCHEDULED' | 'CANCELLED'

export type TrainingSession = {
  id: string
  program: { id: string; name: string; coach_name: string }
  /** UTC, for example "2026-10-03T23:00:00Z". Shown in Sydney time. */
  starts_at: string
  ends_at: string
  location: string
  capacity: number
  booked: number
  available: number
  status: SessionStatus
}

export type SessionData = {
  starts_at: string
  ends_at: string
  location: string
  capacity: number
}

export type SessionBooking = {
  id: string
  player: { id: string; first_name: string; last_name: string }
  created_at: string
}

export const sessionsKey = ['sessions'] as const

/**
 * A coach's upcoming sessions (optionally for one program, and optionally past ones
 * too), or a parent's.
 */
export function useSessions(programId?: string, { includePast = false } = {}) {
  const params = new URLSearchParams()
  if (programId) params.set('program_id', programId)
  if (includePast) params.set('include_past', 'true')
  const query = params.size ? `?${params.toString()}` : ''
  return useQuery({
    queryKey: [...sessionsKey, 'list', programId ?? 'all', includePast],
    queryFn: () => apiGet<TrainingSession[]>(`/sessions${query}`),
  })
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: [...sessionsKey, sessionId],
    queryFn: () => apiGet<TrainingSession>(`/sessions/${sessionId}`),
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SessionData & { program_id: string }) =>
      apiPost<TrainingSession>('/sessions', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })
}

export function useUpdateSession(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SessionData) => apiPatch<TrainingSession>(`/sessions/${sessionId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })
}

export function useCancelSession(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<TrainingSession>(`/sessions/${sessionId}/cancel`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  })
}

export function useSessionBookings(sessionId: string) {
  return useQuery({
    queryKey: [...sessionsKey, sessionId, 'bookings'],
    queryFn: () => apiGet<SessionBooking[]>(`/sessions/${sessionId}/bookings`),
  })
}
