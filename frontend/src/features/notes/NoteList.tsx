import { useState } from 'react'

import { TextButton } from '../../components/Button'
import { EmptyState } from '../../components/Panel'
import { useToast } from '../../components/Toast'
import { formatDate } from '../../lib/dates'
import type { DevelopmentNote, NoteData } from './api'
import { NoteForm } from './NoteForm'

type Props = {
  notes: DevelopmentNote[]
  showProgram: boolean
  /** Only passed for coaches. They can edit the notes they wrote. */
  editor?: { coachId: string; onUpdate: (noteId: string, data: NoteData) => Promise<unknown> }
}

const sections = [
  ['skills', 'Skills being worked on'],
  ['improvements', 'Areas to improve'],
  ['progress', 'Progress'],
] as const

/** Notes as a timeline: the date and coach on the left, what they wrote on the right. */
export function NoteList({ notes, showProgram, editor }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const toast = useToast()

  if (notes.length === 0) return <EmptyState>No development notes yet.</EmptyState>

  return (
    <ul className="divide-y divide-line">
      {notes.map((note) => (
        <li key={note.id} className="grid gap-3 px-4 py-5 sm:grid-cols-[150px_1fr] sm:gap-6 sm:px-5">
          <div>
            <p className="font-semibold tabular-nums">{formatDate(note.noted_on)}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Coach {note.coach_name}
            </p>
            {showProgram && <p className="text-sm text-ink-muted">{note.program.name}</p>}
            {editor?.coachId === note.coach_id && editingId !== note.id && (
              <TextButton className="mt-2" onClick={() => setEditingId(note.id)}>Edit</TextButton>
            )}
          </div>
          {editor && editingId === note.id ? (
            <NoteForm
              initial={note}
              submitLabel="Save note"
              onCancel={() => setEditingId(null)}
              onSubmit={async (data) => {
                await editor.onUpdate(note.id, data)
                setEditingId(null)
                toast('Note saved.')
              }}
            />
          ) : (
            <div className="max-w-prose space-y-3">
              {sections.map(
                ([field, label]) =>
                  note[field] && (
                    <div key={field}>
                      <h3 className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</h3>
                      <p className="mt-1 leading-7 whitespace-pre-line">{note[field]}</p>
                    </div>
                  ),
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
