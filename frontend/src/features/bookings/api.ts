import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPost } from '../../lib/api'
import { sessionsKey, type TrainingSession } from '../sessions/api'

export type BookingStatus = 'CONFIRMED' | 'CANCELLED'

export type Booking = {
  id: string
  status: BookingStatus
  player: { id: string; first_name: string; last_name: string }
  session: TrainingSession
  created_at: string
  cancelled_at: string | null
}

const bookingsKey = ['bookings'] as const

/** A parent's bookings for sessions that haven't finished, optionally for one child. */
export function useBookings(playerId?: string, { enabled = true } = {}) {
  const query = playerId ? `?player_id=${encodeURIComponent(playerId)}` : ''
  return useQuery({
    queryKey: [...bookingsKey, playerId ?? 'all'],
    queryFn: () => apiGet<Booking[]>(`/bookings${query}`),
    enabled,
  })
}

function useRefreshAfterBookingChange() {
  const queryClient = useQueryClient()
  // Places left and who's booked both change, so reload sessions and bookings.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: sessionsKey }),
      queryClient.invalidateQueries({ queryKey: bookingsKey }),
    ])
}

export function useBookSession() {
  const refresh = useRefreshAfterBookingChange()
  return useMutation({
    mutationFn: ({ sessionId, playerId }: { sessionId: string; playerId: string }) =>
      apiPost<Booking>(`/sessions/${sessionId}/bookings`, { player_id: playerId }),
    onSettled: refresh,
  })
}

export function useCancelBooking() {
  const refresh = useRefreshAfterBookingChange()
  return useMutation({
    mutationFn: (bookingId: string) => apiPost<Booking>(`/bookings/${bookingId}/cancel`, {}),
    onSettled: refresh,
  })
}
