import { errorMessage } from '../lib/errors'
import { Notice } from './Notice'

/** What to show while a query is loading or after it failed. */
export function QueryState({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (error) return <Notice tone="danger">{errorMessage(error)}</Notice>
  if (isPending) return <Loading />
  return null
}

/** Placeholder rows shaped like a list, with a shimmer, while data loads. */
export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="divide-y divide-line">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="skeleton size-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
