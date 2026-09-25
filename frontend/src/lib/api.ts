/**
 * Small wrapper around fetch for calling the backend.
 *
 * All requests go to /api/v1. In development Vite proxies /api to the FastAPI
 * backend, so the browser only ever talks to one origin.
 *
 * Errors are normalised into ApiError using the backend's standard error shape:
 *   { "error": { "code": "SOME_CODE", "message": "..." } }
 */

export const API_BASE_URL = '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown } }

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ErrorBody
    const code = typeof body.error?.code === 'string' ? body.error.code : 'HTTP_ERROR'
    const message =
      typeof body.error?.message === 'string' ? body.error.message : response.statusText
    return new ApiError(response.status, code, message || 'Request failed')
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', response.statusText || 'Request failed')
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method: 'GET',
      headers: { Accept: 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server')
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  return (await response.json()) as T
}
