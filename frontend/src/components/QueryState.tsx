import { errorMessage } from '../lib/errors'
import { Notice } from './Notice'

/** What to show while a query is loading or after it failed. */
export function QueryState({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (error) return <Notice tone="danger">{errorMessage(error)}</Notice>
  if (isPending) return <Loading />
  return null
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-ink-muted sm:px-5">
      <span className="size-1.5 animate-pulse rounded-full bg-ink-faint" aria-hidden="true" />
      {label}
    </p>
  )
}
