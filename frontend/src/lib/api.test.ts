import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiGet, apiPost, setAccessToken, setUnauthorizedHandler } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiGet', () => {
  it('prefixes the path with /api/v1 and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiGet('/health')).resolves.toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('turns the backend error format into an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database is unavailable' } },
          503,
        ),
      ),
    )

    const error = await apiGet('/health/db').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database is unavailable',
    })
  })

  it('handles error responses that are not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502, statusText: 'Bad Gateway' })),
    )

    await expect(apiGet('/health')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Bad Gateway',
    })
  })

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(apiGet('/health')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })
})

describe('apiPost and the access token', () => {
  afterEach(() => {
    setAccessToken(null)
    setUnauthorizedHandler(null)
  })

  it('sends a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/auth/login', { email: 'a@example.com' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"email":"a@example.com"}')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('adds the Authorization header when logged in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('abc123')

    await apiGet('/users/me')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc123' })
  })

  it('leaves out the Authorization header when logged out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiGet('/health')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('calls the unauthorized handler when a token is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'INVALID_TOKEN', message: 'x' } }, 401)),
    )
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setAccessToken('expired')

    await expect(apiGet('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not call the unauthorized handler for a failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }, 401)),
    )
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await expect(apiPost('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(handler).not.toHaveBeenCalled()
  })
})
