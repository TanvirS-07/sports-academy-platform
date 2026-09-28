import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

const noRefreshCookie = () =>
  jsonResponse({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Your session has expired.' } }, 401)

/** Backend handlers that restore a login from the refresh cookie, as if the page was reloaded. */
export function loggedInAs(user: { role: string }): Record<string, Handler> {
  return {
    'POST /api/v1/auth/refresh': () => jsonResponse(tokenResponse),
    'GET /api/v1/users/me': () => jsonResponse(user),
  }
}

/**
 * Stubs fetch with one handler per "METHOD /api/v1/path".
 * Unless a test says otherwise, there's no refresh cookie, so the app starts logged out.
 */
export function mockBackend(handlers: Record<string, Handler>) {
  const allHandlers: Record<string, Handler> = { 'POST /api/v1/auth/refresh': noRefreshCookie, ...handlers }
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`
    const handler = allHandlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The RequestInit of each call to one "METHOD /api/v1/path", in order. */
export function callsTo(fetchMock: ReturnType<typeof mockBackend>, key: string): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => `${init?.method ?? 'GET'} ${url}` === key)
    .map(([, init]) => init ?? {})
}

/** The RequestInit of the first call to one "METHOD /api/v1/path". Fails the test if there wasn't one. */
export function firstCallTo(fetchMock: ReturnType<typeof mockBackend>, key: string): RequestInit {
  const [init] = callsTo(fetchMock, key)
  if (!init) throw new Error(`Expected a request to ${key}`)
  return init
}

/** Shows the current path so tests can check where a redirect went. */
function CurrentPath() {
  return <div data-testid="current-path">{useLocation().pathname}</div>
}

/** Renders `ui` at `path` inside the router and auth provider. */
export function renderAt(path: string, routes: { path: string; element: ReactElement }[]) {
  // A fresh cache per test, with no retries so failed requests show up straight away.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
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
      </MemoryRouter>
    </QueryClientProvider>,
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

/** Handlers for a child's page when they have no attendance or development notes yet. */
export const noProgressYet: Record<string, Handler> = {
  'GET /api/v1/players/p1/attendance': () =>
    jsonResponse({ summary: { present: 0, absent: 0, excused: 0, total: 0 }, records: [] }),
  'GET /api/v1/players/p1/development-notes': () => jsonResponse([]),
}

/** Matches the element whose whole text is `text`, even when it's split across spans. */
export function fullText(text: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent === text && ![...element.children].some((child) => child.textContent === text)
}
