import { useAuth } from '../auth/useAuth'

export function ParentPage() {
  const { user } = useAuth()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Parent area</h1>
      <p className="text-slate-600">Welcome, {user?.first_name}.</p>
      <p className="text-slate-600">
        Once your coach adds your child to a program, their sessions and bookings will show here.
      </p>
    </div>
  )
}
