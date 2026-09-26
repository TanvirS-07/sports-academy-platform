import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'

import { AuthProvider } from '../auth/AuthProvider'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (init: RequestInit) => Response | Promise<Response>

/** Stubs fetch with one handler per "METHOD /api/v1/path". */
export function mockBackend(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Shows the current path so tests can check where a redirect went. */
function CurrentPath() {
  return <div data-testid="current-path">{useLocation().pathname}</div>
}

/** Renders `ui` at `path` inside the router and auth provider. */
export function renderAt(path: string, routes: { path: string; element: ReactElement }[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={null} />
        </Routes>
        <CurrentPath />
      </AuthProvider>
    </MemoryRouter>,
  )
}

export const parentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'parent@example.com',
  first_name: 'Alex',
  last_name: 'Taylor',
  role: 'PARENT' as const,
  created_at: '2026-09-26T00:00:00Z',
}

export const coachUser = { ...parentUser, id: '22222222-2222-2222-2222-222222222222', email: 'coach@example.com', first_name: 'Sam', role: 'COACH' as const }

export const tokenResponse = { access_token: 'test-token', token_type: 'bearer', expires_in: 900 }
