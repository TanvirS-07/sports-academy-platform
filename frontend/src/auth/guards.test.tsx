import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { LoginPage } from '../pages/LoginPage'
import { coachUser, jsonResponse, mockBackend, parentUser, renderAt, tokenResponse } from '../test/utils'
import { RequireAuth, RequireRole } from './guards'
import type { User } from './types'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/coach', element: <RequireRole roles={['COACH']}><p>coach content</p></RequireRole> },
  { path: '/parent', element: <RequireRole roles={['PARENT']}><p>parent content</p></RequireRole> },
  { path: '/account', element: <RequireAuth><p>account content</p></RequireAuth> },
]

async function logInAs(user: User) {
  mockBackend({
    'POST /api/v1/auth/login': () => jsonResponse(tokenResponse),
    'GET /api/v1/users/me': () => jsonResponse(user),
  })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('route guards', () => {
  afterEach(() => setAccessToken(null))

  it('sends logged-out users to the login page', () => {
    renderAt('/account', routes)

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
    expect(screen.queryByText('account content')).not.toBeInTheDocument()
  })

  it('returns to the page the user wanted after logging in', async () => {
    renderAt('/account', routes)

    await logInAs(parentUser)

    expect(await screen.findByText('account content')).toBeInTheDocument()
  })

  it('lets a coach into the coach area', async () => {
    renderAt('/coach', routes)

    await logInAs(coachUser)

    expect(await screen.findByText('coach content')).toBeInTheDocument()
  })

  it('sends a parent away from the coach area to their own area', async () => {
    renderAt('/coach', routes)

    await logInAs(parentUser)

    expect(await screen.findByText('parent content')).toBeInTheDocument()
    expect(screen.queryByText('coach content')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/parent')
  })
})
