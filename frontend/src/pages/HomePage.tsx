import { useEffect, useState } from 'react'

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

function StatusRow({ label, state, testId }: { label: string; state: CheckState; testId: string }) {
  const text = state.status === 'loading' ? 'Checking…' : state.status === 'ok' ? 'OK' : 'Unavailable'
  const colour =
    state.status === 'ok'
      ? 'bg-emerald-100 text-emerald-800'
      : state.status === 'error'
        ? 'bg-red-100 text-red-800'
        : 'bg-slate-100 text-slate-600'

  return (
    <div className="flex items-center justify-between py-3">
      <dt className="font-medium">{label}</dt>
      <dd className="flex items-center gap-3">
        {state.status === 'error' && <span className="text-sm text-slate-500">{state.message}</span>}
        <span data-testid={testId} className={`rounded-full px-3 py-1 text-sm font-medium ${colour}`}>
          {text}
        </span>
      </dd>
    </div>
  )
}

export function HomePage() {
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
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Sports Academy Management Platform</h1>
        <p className="max-w-2xl text-slate-600">
          A coach-led platform for managing training programs, sessions, bookings, attendance and
          player development. The first version is built for a cricket academy.
        </p>
      </section>

      <section
        aria-labelledby="system-status-heading"
        className="max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="system-status-heading" className="text-lg font-semibold">
          System status
        </h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <StatusRow label="API" state={systemStatus.api} testId="api-status" />
          <StatusRow label="Database" state={systemStatus.database} testId="database-status" />
        </dl>
      </section>
    </div>
  )
}
