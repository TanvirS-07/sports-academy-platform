import { Link, useNavigate, useParams } from 'react-router'

import { useCreateSession } from '../features/sessions/api'
import { SessionForm } from '../features/sessions/SessionForm'

export function NewSessionPage() {
  const { programId = '' } = useParams()
  const createSession = useCreateSession()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link to={`/coach/programs/${programId}`} className="text-sm text-emerald-700 hover:underline">
          ← Back to program
        </Link>
        <h1 className="text-2xl font-bold">New session</h1>
      </div>
      <SessionForm
        submitLabel="Create session"
        onSubmit={async (data) => {
          const session = await createSession.mutateAsync({ ...data, program_id: programId })
          navigate(`/coach/sessions/${session.id}`, { replace: true })
        }}
      />
    </div>
  )
}
