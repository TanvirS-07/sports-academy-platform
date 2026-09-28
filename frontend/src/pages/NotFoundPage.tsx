import { Link } from 'react-router'

import { homePathFor } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { buttonClasses } from '../components/Button'
import { usePageTitle } from '../components/PageHeader'

export function NotFoundPage() {
  usePageTitle('Page not found')
  const { user } = useAuth()
  return (
    <section className="py-10 sm:py-16">
      <p className="text-sm font-semibold text-ink-muted tabular-nums">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        We couldn’t find that page. It may have moved, or the link may be wrong.
      </p>
      <Link to={user ? homePathFor(user.role) : '/'} className={buttonClasses('primary', 'md', 'mt-8')}>
        Back to home
      </Link>
    </section>
  )
}
