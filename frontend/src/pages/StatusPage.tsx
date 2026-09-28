import { useEffect, useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { ApiError, apiGet } from '../lib/api'

type CheckState = { status: 'loading' } | { status: 'ok' } | { status: 'error'; message: string }

type SystemStatus = { api: CheckState; database: CheckState }

async function runCheck(path: string, signal: AbortSignal): Promise<CheckState> {
  try {
    await apiGet(path, { signal })
    return { status: 'ok' }
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Unexpected error'
    return { status: 'error', message }
  }
}

function StatusItem({ label, state, testId }: { label: string; state: CheckState; testId: string }) {
  const text = state.status === 'loading' ? 'Checking…' : state.status === 'ok' ? 'OK' : 'Unavailable'
  const dot = state.status === 'ok' ? 'bg-success' : state.status === 'error' ? 'bg-danger' : 'bg-ink-faint'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 sm:px-5">
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      <dt className="w-20 font-semibold">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-3 text-ink-muted">
        <span data-testid={testId} className="font-medium text-ink">{text}</span>
        {state.status === 'error' && <span>{state.message}</span>}
      </dd>
    </div>
  )
}

/** Whether the API and database are up. Handy for checking a deployment. */
export function StatusPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    api: { status: 'loading' },
    database: { status: 'loading' },
  })

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      runCheck('/health', controller.signal),
      runCheck('/health/db', controller.signal),
    ]).then(([api, database]) => {
      if (!controller.signal.aborted) {
        setSystemStatus({ api, database })
      }
    })

    return () => controller.abort()
  }, [])

  return (
    <>
      <PageHeader title="System status" description="Checks the API and its database connection." />
      <Panel className="max-w-xl">
        <dl className="divide-y divide-line text-sm">
          <StatusItem label="API" state={systemStatus.api} testId="api-status" />
          <StatusItem label="Database" state={systemStatus.database} testId="database-status" />
        </dl>
      </Panel>
    </>
  )
}
