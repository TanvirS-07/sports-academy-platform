import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { callsTo, firstCallTo, jsonResponse, mockBackend, parentUser, tokenResponse } from '../test/utils'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function WhoAmI() {
  const { user, restoring, logout } = useAuth()
  if (restoring) return <p>checking</p>
  if (!user) return <p>logged out</p>
  return (
    <>
      <p>logged in as {user.email}</p>
      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </>
  )
}

function renderProvider() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AuthProvider', () => {
  afterEach(() => setAccessToken(null))

  it('restores the login from the refresh cookie on load', async () => {
    const fetchMock = mockBackend({
      'POST /api/v1/auth/refresh': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(parentUser),
    })

    renderProvider()

    expect(screen.getByText('checking')).toBeInTheDocument()
    expect(await screen.findByText('logged in as parent@example.com')).toBeInTheDocument()
    const meInit = firstCallTo(fetchMock, 'GET /api/v1/users/me')
    expect(meInit.headers).toMatchObject({ Authorization: `Bearer ${tokenResponse.access_token}` })
  })

  it('stays logged out when there is no refresh cookie', async () => {
    const fetchMock = mockBackend({})

    renderProvider()

    expect(await screen.findByText('logged out')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'GET /api/v1/users/me')).toHaveLength(0)
  })

  it('calls the logout endpoint when logging out', async () => {
    const fetchMock = mockBackend({
      'POST /api/v1/auth/refresh': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(parentUser),
      'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
    })
    renderProvider()

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByText('logged out')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'POST /api/v1/auth/logout')).toHaveLength(1)
  })
})
