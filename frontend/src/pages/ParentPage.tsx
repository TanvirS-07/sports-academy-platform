import { Link } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { QueryState } from '../components/QueryState'
import { usePlayers } from '../features/players/api'
import { formatDate } from '../lib/dates'

export function ParentPage() {
  const { user } = useAuth()
  const players = usePlayers()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Parent area</h1>
        <p className="text-slate-600">Welcome, {user?.first_name}.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My players</h2>
          <Link to="/parent/players/new"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
            Add player
          </Link>
        </div>
        <QueryState isPending={players.isPending} error={players.error} />
        {players.data?.length === 0 && (
          <p className="text-slate-600">
            Add your child here. Their coach can then enrol them in a program.
          </p>
        )}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {players.data?.map((player) => (
            <li key={player.id}>
              <Link to={`/parent/players/${player.id}`} className="flex justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-medium">{player.first_name} {player.last_name}</span>
                <span className="text-sm text-slate-500">Born {formatDate(player.date_of_birth)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
