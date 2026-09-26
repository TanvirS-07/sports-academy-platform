import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { coachUser, jsonResponse, mockBackend, parentUser, renderAt, tokenResponse } from '../test/utils'
import { LoginPage } from './LoginPage'

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

const routes = [{ path: '/login', element: <LoginPage /> }]

describe('LoginPage', () => {
  afterEach(() => setAccessToken(null))

  it('logs a parent in and goes to the parent area', async () => {
    const fetchMock = mockBackend({
      'POST /api/v1/auth/login': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(parentUser),
    })

    renderAt('/login', routes)
    fillAndSubmit('parent@example.com', 'a-good-password')

    expect(await screen.findByText('/parent')).toBeInTheDocument()
    const [, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(loginInit.body as string)).toEqual({
      email: 'parent@example.com',
      password: 'a-good-password',
    })
  })

  it('sends a coach to the coach area', async () => {
    mockBackend({
      'POST /api/v1/auth/login': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(coachUser),
    })

    renderAt('/login', routes)
    fillAndSubmit('coach@example.com', 'a-good-password')

    expect(await screen.findByText('/coach')).toBeInTheDocument()
  })

  it('shows the error from the backend when login fails', async () => {
    mockBackend({
      'POST /api/v1/auth/login': () =>
        jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401),
    })

    renderAt('/login', routes)
    fillAndSubmit('parent@example.com', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
  })
})
