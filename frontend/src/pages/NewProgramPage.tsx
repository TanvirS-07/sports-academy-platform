import { Link, useNavigate } from 'react-router'

import { useCreateProgram } from '../features/programs/api'
import { ProgramForm } from '../features/programs/ProgramForm'

export function NewProgramPage() {
  const createProgram = useCreateProgram()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <Link to="/coach" className="text-sm text-emerald-700 hover:underline">← My programs</Link>
        <h1 className="text-2xl font-bold">New program</h1>
      </div>
      <ProgramForm
        submitLabel="Create program"
        onSubmit={async (data) => {
          const program = await createProgram.mutateAsync(data)
          navigate(`/coach/programs/${program.id}`, { replace: true })
        }}
      />
    </div>
  )
}
