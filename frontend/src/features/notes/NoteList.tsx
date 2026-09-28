import { useState } from 'react'

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

export function NoteList({ notes, showProgram, editor }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  if (notes.length === 0) return <p className="text-slate-600">No development notes yet.</p>

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{formatDate(note.noted_on)}</p>
              <p className="text-sm text-slate-500">
                Coach {note.coach_name}{showProgram && ` · ${note.program.name}`}
              </p>
            </div>
            {editor?.coachId === note.coach_id && editingId !== note.id && (
              <button type="button" onClick={() => setEditingId(note.id)}
                className="text-sm font-medium text-emerald-700 hover:underline">
                Edit
              </button>
            )}
          </div>
          {editor && editingId === note.id ? (
            <NoteForm
              initial={note}
              submitLabel="Save note"
              onSubmit={async (data) => {
                await editor.onUpdate(note.id, data)
                setEditingId(null)
              }}
            />
          ) : (
            sections.map(
              ([field, label]) =>
                note[field] && (
                  <div key={field}>
                    <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                    <p className="whitespace-pre-line">{note[field]}</p>
                  </div>
                ),
            )
          )}
        </li>
      ))}
    </ul>
  )
}
