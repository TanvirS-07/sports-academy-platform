import { Link, useNavigate } from 'react-router'

import { useCreatePlayer } from '../features/players/api'
import { PlayerForm } from '../features/players/PlayerForm'

export function NewPlayerPage() {
  const createPlayer = useCreatePlayer()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <Link to="/parent" className="text-sm text-emerald-700 hover:underline">← My players</Link>
        <h1 className="text-2xl font-bold">Add a player</h1>
      </div>
      <PlayerForm
        submitLabel="Add player"
        onSubmit={async (data) => {
          const player = await createPlayer.mutateAsync(data)
          navigate(`/parent/players/${player.id}`, { replace: true })
        }}
      />
    </div>
  )
}
