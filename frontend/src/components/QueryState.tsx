import { errorMessage } from '../lib/errors'

/** What to show while a query is loading or after it failed. */
export function QueryState({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        {errorMessage(error)}
      </p>
    )
  }
  if (isPending) return <p className="text-slate-500">Loading…</p>
  return null
}
