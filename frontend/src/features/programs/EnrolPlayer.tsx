import { useState, type FormEvent } from 'react'

import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { useEnrolPlayer, usePlayerSearch, type Enrolment } from './api'

/** Search for a player by name and enrol them in the program. */
export function EnrolPlayer({ programId, roster }: { programId: string; roster: Enrolment[] }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const search = usePlayerSearch(query)
  const enrol = useEnrolPlayer(programId)

  const activeIds = new Set(roster.filter((e) => e.status === 'ACTIVE').map((e) => e.player_id))

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(text.trim())
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Enrol a player</h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <label htmlFor="player-search" className="sr-only">Player name</label>
        <input id="player-search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by name"
          className="block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none" />
        <button type="submit"
          className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800">
          Search
        </button>
      </form>
      {query.length === 1 && <p className="text-sm text-slate-500">Type at least 2 letters.</p>}
      {enrol.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage(enrol.error)}
        </p>
      )}
      {query.length >= 2 && <QueryState isPending={search.isPending} error={search.error} />}
      {search.data?.length === 0 && <p className="text-sm text-slate-500">No players found.</p>}
      <ul className="divide-y divide-slate-200">
        {search.data?.map((player) => (
          <li key={player.id} className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">{player.first_name} {player.last_name}</p>
              {player.parent_first_names.length > 0 && (
                <p className="text-sm text-slate-500">Parent: {player.parent_first_names.join(', ')}</p>
              )}
            </div>
            {activeIds.has(player.id) ? (
              <span className="text-sm text-slate-500">Enrolled</span>
            ) : (
              <button type="button" disabled={enrol.isPending}
                onClick={() => enrol.mutate(player.id)}
                aria-label={`Enrol ${player.first_name} ${player.last_name}`}
                className="rounded-md border border-emerald-700 px-3 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">
                Enrol
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
