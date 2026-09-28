import { useQuery } from '@tanstack/react-query'

import type { User } from '../auth/types'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { apiGet } from '../lib/api'

const ROLE_LABELS: Record<User['role'], string> = {
  COACH: 'Coach',
  PARENT: 'Parent',
  PLAYER: 'Player',
}

export function AccountPage() {
  const me = useQuery({ queryKey: ['users', 'me'], queryFn: () => apiGet<User>('/users/me') })

  return (
    <>
      <PageHeader title="Account" description="The details the academy has for you." />
      <QueryState isPending={me.isPending} error={me.error} />
      {me.data && (
        <Panel title="Your details" id="details" className="max-w-2xl">
          <dl className="divide-y divide-line">
            {[
              ['Name', `${me.data.first_name} ${me.data.last_name}`],
              ['Email', me.data.email],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-3.5 sm:grid-cols-[160px_1fr] sm:px-5">
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="font-medium break-words">{value}</dd>
              </div>
            ))}
            <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[160px_1fr] sm:px-5">
              <dt className="text-sm text-ink-muted">Account type</dt>
              <dd className="font-medium" data-testid="account-role">{ROLE_LABELS[me.data.role]}</dd>
            </div>
          </dl>
          <p className="border-t border-line px-4 py-3.5 text-sm text-ink-muted sm:px-5">
            To change your name or email, contact the academy.
          </p>
        </Panel>
      )}
    </>
  )
}
