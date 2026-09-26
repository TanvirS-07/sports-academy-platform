import { useAuth } from '../auth/useAuth'

export function CoachPage() {
  const { user } = useAuth()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Coach area</h1>
      <p className="text-slate-600">Welcome, {user?.first_name}.</p>
      <p className="text-slate-600">Programs, players and sessions arrive in Phase 3.</p>
    </div>
  )
}
