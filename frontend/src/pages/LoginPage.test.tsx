import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '../lib/api'
import { callsTo, coachUser, firstCallTo, jsonResponse, mockBackend, parentUser, renderAt, tokenResponse } from '../test/utils'
import { LoginPage } from './LoginPage'

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

const routes = [{ path: '/login', element: <LoginPage /> }]

describe('LoginPage', () => {
  afterEach(() => {
    setAccessToken(null)
    vi.unstubAllEnvs()
  })

  it('logs a parent in and goes to the parent area', async () => {
    const fetchMock = mockBackend({
      'POST /api/v1/auth/login': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(parentUser),
    })

    renderAt('/login', routes)
    fillAndSubmit('parent@example.com', 'a-good-password')

    expect(await screen.findByText('/parent')).toBeInTheDocument()
    const loginInit = firstCallTo(fetchMock, 'POST /api/v1/auth/login')
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

  it('hides the demo logins outside the live demo', () => {
    renderAt('/login', routes)

    expect(screen.queryByText('This is a demo with made-up data')).not.toBeInTheDocument()
  })

  it('fills in a demo login on the live demo', () => {
    vi.stubEnv('VITE_DEMO', 'true')
    renderAt('/login', routes)

    fireEvent.click(screen.getByRole('button', { name: 'Coach: coach@example.com' }))

    expect(screen.getByLabelText('Email')).toHaveValue('coach@example.com')
    expect(screen.getByLabelText('Password')).toHaveValue('demo-password')
  })

  it('hides Google sign-in when the backend has it turned off', async () => {
    const fetchMock = mockBackend({})

    renderAt('/login', routes)

    await vi.waitFor(() => expect(callsTo(fetchMock, 'GET /api/v1/auth/options')).toHaveLength(1))
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument()
  })

  it('links to the backend to continue with Google', async () => {
    mockBackend({ 'GET /api/v1/auth/options': () => jsonResponse({ google: true }) })

    renderAt('/login', routes)

    const link = await screen.findByRole('link', { name: 'Continue with Google' })
    expect(link).toHaveAttribute('href', '/api/v1/auth/google/start')
    expect(screen.getByText('For parents. Coaches log in with their email and password.')).toBeInTheDocument()
  })

  it('explains why Google sign-in was refused', () => {
    mockBackend({})

    renderAt('/login?google_error=coach_account', routes)

    expect(screen.getByRole('alert')).toHaveTextContent('Coaches log in with their email and password.')
  })

  it('shows a general message for an unknown Google error', () => {
    mockBackend({})

    renderAt('/login?google_error=something_new', routes)

    expect(screen.getByRole('alert')).toHaveTextContent('Signing in with Google didn’t work. Please try again.')
  })
})
