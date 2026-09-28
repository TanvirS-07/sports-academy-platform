import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

export type Crumb = { label: string; to: string }

/** Sets the browser tab title, like "Sessions · Precision Cricket Academy". */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Precision Cricket Academy` : 'Precision Cricket Academy'
  }, [title])
}

/**
 * The top of every page: where you are, the title, one line of context and the
 * page's actions. Also sets the tab title.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  tabTitle,
}: {
  title: ReactNode
  description?: ReactNode
  back?: Crumb
  actions?: ReactNode
  tabTitle?: string
}) {
  usePageTitle(tabTitle ?? (typeof title === 'string' ? title : undefined))
  return (
    <header className="mb-6 border-b border-line pb-6 sm:mb-8">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M12.8 5.2a.75.75 0 0 1 0 1.06L9.06 10l3.74 3.74a.75.75 0 1 1-1.06 1.06l-4.27-4.27a.75.75 0 0 1 0-1.06l4.27-4.27a.75.75 0 0 1 1.06 0Z" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-[28px] sm:leading-9">{title}</h1>
          {description && <div className="mt-1.5 text-[15px] text-ink-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
