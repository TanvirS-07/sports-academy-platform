import { describe, expect, it, vi } from 'vitest'

import { ApiError, apiGet } from './api'

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
