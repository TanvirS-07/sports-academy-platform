import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet, apiPatch, apiPost } from '../../lib/api'

export type DevelopmentNote = {
  id: string
  player_id: string
  program: { id: string; name: string }
  coach_id: string
  coach_name: string
  /** "YYYY-MM-DD" */
  noted_on: string
  skills: string
  improvements: string
  progress: string
  created_at: string
  updated_at: string
}

export type NoteData = {
  noted_on: string
  skills: string
  improvements: string
  progress: string
}

const notesKey = ['development-notes'] as const

/** A player's notes, newest first. Coaches only get notes from their own programs. */
export function useNotes(playerId: string, programId?: string) {
  const query = programId ? `?program_id=${encodeURIComponent(programId)}` : ''
  return useQuery({
    queryKey: [...notesKey, playerId, programId ?? 'all'],
    queryFn: () => apiGet<DevelopmentNote[]>(`/players/${playerId}/development-notes${query}`),
  })
}

export function useAddNote(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: NoteData & { program_id: string }) =>
      apiPost<DevelopmentNote>(`/players/${playerId}/development-notes`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey }),
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: NoteData }) =>
      apiPatch<DevelopmentNote>(`/development-notes/${noteId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey }),
  })
}
