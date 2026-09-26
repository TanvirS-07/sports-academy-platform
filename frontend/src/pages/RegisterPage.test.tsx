import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { jsonResponse, mockBackend, parentUser, renderAt, tokenResponse } from '../test/utils'
import { RegisterPage } from './RegisterPage'

const routes = [{ path: '/register', element: <RegisterPage /> }]

function fillForm(password: string) {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alex' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Taylor' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'parent@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage', () => {
  afterEach(() => setAccessToken(null))

  it('registers, logs in and goes to the parent area', async () => {
    const fetchMock = mockBackend({
      'POST /api/v1/auth/register': () => jsonResponse(parentUser, 201),
      'POST /api/v1/auth/login': () => jsonResponse(tokenResponse),
      'GET /api/v1/users/me': () => jsonResponse(parentUser),
    })

    renderAt('/register', routes)
    fillForm('a-good-password')

    expect(await screen.findByText('/parent')).toBeInTheDocument()
    const [, registerInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(registerInit.body as string)
    expect(sent).toEqual({
      first_name: 'Alex',
      last_name: 'Taylor',
      email: 'parent@example.com',
      password: 'a-good-password',
    })
    expect(sent).not.toHaveProperty('role')
  })

  it('checks the password length before sending anything', () => {
    const fetchMock = mockBackend({})

    renderAt('/register', routes)
    fillForm('short')

    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a message when the email is already registered', async () => {
    mockBackend({
      'POST /api/v1/auth/register': () =>
        jsonResponse(
          { error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists' } },
          409,
        ),
    })

    renderAt('/register', routes)
    fillForm('a-good-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  })
})
