import { Link, Outlet, useNavigate } from 'react-router'

import { homePathFor } from '../auth/types'
import { useAuth } from '../auth/useAuth'

function HeaderNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link to="/login" className="text-slate-700 hover:text-emerald-800">
          Log in
        </Link>
        <Link to="/register" className="rounded-md bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800">
          Register
        </Link>
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-4 text-sm font-medium">
      <Link to={homePathFor(user.role)} className="text-slate-700 hover:text-emerald-800">
        {user.role === 'COACH' ? 'Coach area' : 'My area'}
      </Link>
      <Link to="/account" className="text-slate-700 hover:text-emerald-800" data-testid="header-user">
        {user.first_name}
      </Link>
      <button
        type="button"
        onClick={() => {
          logout()
          navigate('/', { replace: true })
        }}
        className="text-slate-500 hover:text-slate-800"
      >
        Log out
      </button>
    </nav>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-emerald-800">
            Sports Academy Platform
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-500">
          Sports Academy Management Platform
        </div>
      </footer>
    </div>
  )
}
