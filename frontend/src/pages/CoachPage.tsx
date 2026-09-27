import { Link } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { QueryState } from '../components/QueryState'
import { usePrograms } from '../features/programs/api'

export function CoachPage() {
  const { user } = useAuth()
  const programs = usePrograms()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Coach area</h1>
        <p className="text-slate-600">Welcome, {user?.first_name}.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My programs</h2>
          <Link to="/coach/programs/new"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
            New program
          </Link>
        </div>
        <QueryState isPending={programs.isPending} error={programs.error} />
        {programs.data?.length === 0 && (
          <p className="text-slate-600">Create a program, then enrol players into it.</p>
        )}
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {programs.data?.map((program) => (
            <li key={program.id}>
              <Link to={`/coach/programs/${program.id}`} className="flex justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-medium">{program.name}</span>
                <span className="text-sm text-slate-500">{program.sport.name} · {program.age_group}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
