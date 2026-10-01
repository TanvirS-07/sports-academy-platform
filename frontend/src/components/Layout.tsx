import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { lift } from './Button'

import logoMark from '../assets/logo-mark.svg'
import { homePathFor, type User } from '../auth/types'
import { useAuth } from '../auth/useAuth'

type NavItem = { label: string; to: string; end?: boolean }

function navFor(user: User | null): NavItem[] {
  if (user?.role === 'COACH') {
    return [
      { label: 'Programs', to: '/coach' },
      { label: 'Calendar', to: '/calendar' },
    ]
  }
  if (user?.role === 'PARENT') {
    return [
      { label: 'Home', to: '/parent', end: true },
      { label: 'Sessions', to: '/parent/sessions' },
      { label: 'Calendar', to: '/calendar' },
    ]
  }
  return []
}

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const large = size === 'lg'
  return (
    <span className="flex items-center gap-3">
      <img src={logoMark} alt="" className={large ? 'h-14 w-auto' : 'h-9 w-auto'} />
      <span className="leading-none">
        <span className={`block font-extrabold tracking-[0.08em] uppercase ${large ? 'text-3xl' : 'text-[15px]'}`}>
          Precision
        </span>
        <span className={`mt-1 block tracking-[0.22em] whitespace-nowrap text-white/65 uppercase ${large ? 'text-xs' : 'text-[10px]'}`}>
          Cricket Academy
        </span>
      </span>
    </span>
  )
}

function NavLinks({ items, className }: { items: NavItem[]; className: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex h-full items-center border-b-2 px-1 text-sm font-medium transition-colors ${
                isActive ? 'border-accent text-white' : 'border-transparent text-white/70 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function Header() {
  const { user, restoring, logout } = useAuth()
  const navigate = useNavigate()
  const items = navFor(user)

  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex h-full items-center gap-10">
          <Link to={user ? homePathFor(user.role) : '/'} aria-label="Precision Cricket Academy home" className="rounded-sm">
            <Wordmark />
          </Link>
          {items.length > 0 && (
            <nav aria-label="Main" className="hidden h-full md:block">
              <NavLinks items={items} className="flex h-full gap-7" />
            </nav>
          )}
        </div>

        {!restoring && (
          <div className="flex items-center gap-2 text-sm font-medium sm:gap-3">
            {user ? (
              <>
                <Link
                  to="/account"
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-white/90 hover:bg-white/10 hover:text-white ${lift}`}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-7 place-items-center rounded-full bg-white/15 text-xs font-semibold"
                  >
                    {user.first_name.charAt(0)}
                    {user.last_name.charAt(0)}
                  </span>
                  <span data-testid="header-user" className="sr-only sm:not-sr-only">{user.first_name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void logout()
                    navigate('/', { replace: true })
                  }}
                  className={`rounded-md px-2 py-1.5 whitespace-nowrap text-white/70 hover:bg-white/10 hover:text-white ${lift}`}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={`rounded-md px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white ${lift}`}>
                  Log in
                </Link>
                <Link to="/register" className={`rounded-md bg-white px-3 py-1.5 font-semibold text-brand hover:bg-white/90 ${lift}`}>
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <nav aria-label="Main" className="border-t border-white/10 md:hidden">
          <NavLinks items={items} className="mx-auto flex h-11 max-w-6xl gap-6 overflow-x-auto px-4" />
        </nav>
      )}
    </header>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <Header />

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        {/* Keyed by path so each page fades in when you navigate to it. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between sm:px-6">
          <span>Precision Cricket Academy · Sydney</span>
          <span className="flex flex-wrap gap-x-4">
            <span>All session times are Sydney time</span>
            <Link to="/status" className="underline-offset-4 hover:text-ink hover:underline">System status</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
