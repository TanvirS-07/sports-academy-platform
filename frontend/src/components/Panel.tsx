import type { ReactNode } from 'react'

/**
 * A bordered section with a small uppercase heading. The main way content is
 * grouped on every page; lists and tables sit flush inside it.
 */
export function Panel({
  title,
  action,
  children,
  id,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  id?: string
  className?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section aria-labelledby={headingId} className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {title && (
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-line bg-subtle/60 px-4 py-2 sm:px-5">
          <h2 id={headingId} className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PanelBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-4 sm:px-5 ${className}`}>{children}</div>
}

/** A list of rows inside a panel. */
export function RowList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line">
      {children}
    </ul>
  )
}

/** The one-line message and single action shown when a list has nothing in it. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <p className="max-w-sm text-sm leading-6 text-ink-muted">{children}</p>
      {action}
    </div>
  )
}
