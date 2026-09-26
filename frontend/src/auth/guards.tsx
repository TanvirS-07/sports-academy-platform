import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { homePathFor, type Role } from './types'
import { useAuth } from './useAuth'

/** Sends logged-out users to /login, then back here after they log in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/**
 * Only lets the given roles through. Anyone else is sent to their own area.
 * This only hides pages. The backend enforces the real permission checks.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return children
}
