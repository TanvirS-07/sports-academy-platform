import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HomePage } from './HomePage'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockBackend(responses: Record<string, () => Promise<Response>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const handler = responses[url]
      if (!handler) throw new Error(`Unexpected request to ${url}`)
      return handler()
    }),
  )
}

describe('HomePage', () => {
  it('shows OK for the API and database when both are healthy', async () => {
    mockBackend({
      '/api/v1/health': async () => jsonResponse({ status: 'ok' }),
      '/api/v1/health/db': async () => jsonResponse({ status: 'ok', database: 'ok' }),
    })

    render(<HomePage />)

    expect(await screen.findByTestId('api-status')).toHaveTextContent('OK')
    expect(screen.getByTestId('database-status')).toHaveTextContent('OK')
  })

  it('shows the database as unavailable when the backend reports it is down', async () => {
    mockBackend({
      '/api/v1/health': async () => jsonResponse({ status: 'ok' }),
      '/api/v1/health/db': async () =>
        jsonResponse({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' } }, 503),
    })

    render(<HomePage />)

    expect(await screen.findByText('Database is unavailable')).toBeInTheDocument()
    expect(screen.getByTestId('api-status')).toHaveTextContent('OK')
    expect(screen.getByTestId('database-status')).toHaveTextContent('Unavailable')
  })

  it('shows both checks as unavailable when the server cannot be reached', async () => {
    mockBackend({
      '/api/v1/health': async () => Promise.reject(new TypeError('Failed to fetch')),
      '/api/v1/health/db': async () => Promise.reject(new TypeError('Failed to fetch')),
    })

    render(<HomePage />)

    expect(await screen.findAllByText('Unable to reach the server')).toHaveLength(2)
    expect(screen.getByTestId('api-status')).toHaveTextContent('Unavailable')
    expect(screen.getByTestId('database-status')).toHaveTextContent('Unavailable')
  })

  it('shows a checking state while requests are in flight', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<HomePage />)

    expect(screen.getByTestId('api-status')).toHaveTextContent('Checking…')
    expect(screen.getByTestId('database-status')).toHaveTextContent('Checking…')
  })
})
