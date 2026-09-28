import { useState, type FormEvent } from 'react'

import { Button } from '../../components/Button'
import { inputClasses } from '../../components/FormField'
import { Notice } from '../../components/Notice'
import { QueryState } from '../../components/QueryState'
import { Tag } from '../../components/Tag'
import { useToast } from '../../components/Toast'
import { errorMessage } from '../../lib/errors'
import { useEnrolPlayer, usePlayerSearch, type Enrolment } from './api'

/** Search for a player by name and enrol them in the program. */
export function EnrolPlayer({ programId, roster }: { programId: string; roster: Enrolment[] }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const search = usePlayerSearch(query)
  const enrol = useEnrolPlayer(programId)
  const toast = useToast()

  const activeIds = new Set(roster.filter((e) => e.status === 'ACTIVE').map((e) => e.player_id))

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(text.trim())
  }

  return (
    <div className="border-b border-line px-4 py-4 sm:px-5">
      <form onSubmit={handleSearch} className="flex gap-2" role="search">
        <label htmlFor="player-search" className="sr-only">Player name</label>
        <input id="player-search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Find a player to enrol" className={`${inputClasses} h-10 min-w-0 flex-1`} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {query.length === 1 && <p className="mt-2 text-[13px] text-ink-muted">Type at least 2 letters.</p>}
      {enrol.error && (
        <div className="mt-3">
          <Notice tone="danger">{errorMessage(enrol.error)}</Notice>
        </div>
      )}
      {query.length >= 2 && <QueryState isPending={search.isPending} error={search.error} />}
      {search.data?.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          No players found. Their parent needs to add them to their account first.
        </p>
      )}
      {search.data && search.data.length > 0 && (
        <ul aria-label="Search results" className="mt-3 divide-y divide-line rounded-md border border-line">
          {search.data.map((player) => {
            const name = `${player.first_name} ${player.last_name}`
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold">{name}</p>
                  {player.parent_first_names.length > 0 && (
                    <p className="text-[13px] text-ink-muted">Parent: {player.parent_first_names.join(', ')}</p>
                  )}
                </div>
                {activeIds.has(player.id) ? (
                  <Tag tone="success">Enrolled</Tag>
                ) : (
                  <Button size="sm" variant="secondary" disabled={enrol.isPending}
                    onClick={() => enrol.mutate(player.id, { onSuccess: () => toast(`${name} enrolled.`) })}
                    aria-label={`Enrol ${name}`}>
                    Enrol
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
