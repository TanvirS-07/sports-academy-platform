/**
 * Small wrapper around fetch for calling the backend.
 *
 * All requests go to /api/v1. In development Vite proxies /api to the FastAPI
 * backend, so the browser only ever talks to one origin.
 *
 * When the user is logged in, the access token is attached as a Bearer header.
 * The token is kept in memory only (never localStorage), so it's gone after a
 * page refresh. Phase 2b adds a refresh cookie to fix that.
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

let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Called when a request sent with a token comes back 401 (for example, it expired). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const sentToken = accessToken
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers: { ...headers, ...init?.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server')
  }

  if (!response.ok) {
    if (response.status === 401 && sentToken) onUnauthorized?.()
    throw await toApiError(response)
  }

  return (await response.json()) as T
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>('GET', path, undefined, init)
}

export function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return request<T>('POST', path, body, init)
}
