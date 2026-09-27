import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { QueryState } from '../components/QueryState'
import { usePlayer, useUpdatePlayer } from '../features/players/api'
import { PlayerForm } from '../features/players/PlayerForm'
import { formatDate } from '../lib/dates'

export function PlayerPage() {
  const { playerId = '' } = useParams()
  const player = usePlayer(playerId)
  const updatePlayer = useUpdatePlayer(playerId)
  const [editing, setEditing] = useState(false)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/parent" className="text-sm text-emerald-700 hover:underline">← My players</Link>
      <QueryState isPending={player.isPending} error={player.error} />

      {player.data && (
        <>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{player.data.first_name} {player.data.last_name}</h1>
              <p className="text-slate-600">Born {formatDate(player.data.date_of_birth)}</p>
            </div>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)}
                className="text-sm font-medium text-emerald-700 hover:underline">
                Edit
              </button>
            )}
          </div>

          {editing && (
            <PlayerForm
              initial={player.data}
              submitLabel="Save changes"
              onSubmit={async (data) => {
                await updatePlayer.mutateAsync(data)
                setEditing(false)
              }}
            />
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Programs</h2>
            {player.data.programs.length === 0 ? (
              <p className="text-slate-600">Not enrolled in a program yet. Their coach will add them.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                {player.data.programs.map((program) => (
                  <li key={program.id} className="px-4 py-3">
                    <p className="font-medium">{program.name}</p>
                    <p className="text-sm text-slate-500">
                      {program.sport} · {program.age_group} · Coach {program.coach_name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
