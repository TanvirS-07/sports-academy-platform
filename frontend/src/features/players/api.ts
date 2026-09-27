import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPatch, apiPost } from '../../lib/api'

export type Player = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
}

export type PlayerProgram = {
  id: string
  name: string
  sport: string
  age_group: string
  coach_name: string
}

export type PlayerDetail = Player & { programs: PlayerProgram[] }

export type PlayerData = Omit<Player, 'id'>

const playersKey = ['players'] as const

export function usePlayers() {
  return useQuery({ queryKey: playersKey, queryFn: () => apiGet<Player[]>('/players') })
}

export function usePlayer(playerId: string) {
  return useQuery({
    queryKey: [...playersKey, playerId],
    queryFn: () => apiGet<PlayerDetail>(`/players/${playerId}`),
  })
}

export function useCreatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: PlayerData) => apiPost<Player>('/players', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playersKey }),
  })
}

export function useUpdatePlayer(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: PlayerData) => apiPatch<Player>(`/players/${playerId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playersKey }),
  })
}
