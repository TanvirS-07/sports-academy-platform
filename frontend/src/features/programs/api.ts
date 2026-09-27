import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPatch, apiPost } from '../../lib/api'

export type Sport = { id: string; name: string }

export type Program = {
  id: string
  name: string
  sport: Sport
  age_group: string
  description: string
  objectives: string
}

export type ProgramData = {
  name: string
  sport_id: string
  age_group: string
  description: string
  objectives: string
}

export type EnrolmentStatus = 'ACTIVE' | 'INACTIVE'

export type Enrolment = {
  player_id: string
  first_name: string
  last_name: string
  /** Only sent while the enrolment is active. */
  date_of_birth: string | null
  status: EnrolmentStatus
  enrolled_at: string
}

export type PlayerSearchResult = {
  id: string
  first_name: string
  last_name: string
  parent_first_names: string[]
}

const programsKey = ['programs'] as const

export function useSports() {
  return useQuery({ queryKey: ['sports'], queryFn: () => apiGet<Sport[]>('/sports') })
}

export function usePrograms() {
  return useQuery({ queryKey: programsKey, queryFn: () => apiGet<Program[]>('/programs') })
}

export function useProgram(programId: string) {
  return useQuery({
    queryKey: [...programsKey, programId],
    queryFn: () => apiGet<Program>(`/programs/${programId}`),
  })
}

export function useCreateProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProgramData) => apiPost<Program>('/programs', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programsKey }),
  })
}

export function useUpdateProgram(programId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProgramData) => apiPatch<Program>(`/programs/${programId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programsKey }),
  })
}

function rosterKey(programId: string) {
  return [...programsKey, programId, 'players']
}

export function useRoster(programId: string) {
  return useQuery({
    queryKey: rosterKey(programId),
    queryFn: () => apiGet<Enrolment[]>(`/programs/${programId}/players`),
  })
}

export function useEnrolPlayer(programId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playerId: string) =>
      apiPost<Enrolment>(`/programs/${programId}/players`, { player_id: playerId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rosterKey(programId) }),
  })
}

export function useSetEnrolmentStatus(programId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: EnrolmentStatus }) =>
      apiPatch<Enrolment>(`/programs/${programId}/players/${playerId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rosterKey(programId) }),
  })
}

export function usePlayerSearch(query: string) {
  return useQuery({
    queryKey: ['player-search', query],
    // Sent as a POST so children's names stay out of URLs and server logs.
    queryFn: () => apiPost<PlayerSearchResult[]>('/players/search', { query }),
    enabled: query.length >= 2,
  })
}
