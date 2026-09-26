import { useEffect, useState } from 'react'

import type { User } from '../auth/types'
import { apiGet } from '../lib/api'
import { errorMessage } from '../lib/errors'

const ROLE_LABELS: Record<User['role'], string> = {
  COACH: 'Coach',
  PARENT: 'Parent',
  PLAYER: 'Player',
}

export function AccountPage() {
  const [me, setMe] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiGet<User>('/users/me', { signal: controller.signal })
      .then(setMe)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(err))
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Your account</h1>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      {!me && !error && <p className="text-slate-500">Loading…</p>}
      {me && (
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex justify-between py-3">
            <dt className="font-medium">Name</dt>
            <dd>{me.first_name} {me.last_name}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="font-medium">Email</dt>
            <dd>{me.email}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="font-medium">Role</dt>
            <dd data-testid="account-role">{ROLE_LABELS[me.role]}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
