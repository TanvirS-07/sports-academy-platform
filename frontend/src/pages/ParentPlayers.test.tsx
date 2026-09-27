import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { firstCallTo, jsonResponse, loggedInAs, mockBackend, parentUser, renderAt } from '../test/utils'
import { NewPlayerPage } from './NewPlayerPage'
import { ParentPage } from './ParentPage'
import { PlayerPage } from './PlayerPage'

const routes = [
  { path: '/parent', element: <ParentPage /> },
  { path: '/parent/players/new', element: <NewPlayerPage /> },
  { path: '/parent/players/:playerId', element: <PlayerPage /> },
]

const sam = { id: 'p1', first_name: 'Sam', last_name: 'Taylor', date_of_birth: '2013-05-14' }
const program = {
  id: 'g1',
  name: 'U14 Cricket Development',
  sport: 'Cricket',
  age_group: 'Under 14',
  coach_name: 'Chris Lee',
}

describe('parent player pages', () => {
  afterEach(() => setAccessToken(null))

  it('lists the parent’s players', async () => {
    mockBackend({ ...loggedInAs(parentUser), 'GET /api/v1/players': () => jsonResponse([sam]) })

    renderAt('/parent', routes)

    expect(await screen.findByText('Sam Taylor')).toBeInTheDocument()
    expect(screen.getByText('Born 14 May 2013')).toBeInTheDocument()
  })

  it('adds a player and opens their page', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(parentUser),
      'POST /api/v1/players': () => jsonResponse(sam, 201),
      'GET /api/v1/players/p1': () => jsonResponse({ ...sam, programs: [] }),
    })

    renderAt('/parent/players/new', routes)
    fireEvent.change(await screen.findByLabelText('First name'), { target: { value: 'Sam' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Taylor' } })
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2013-05-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }))

    expect(await screen.findByText('/parent/players/p1')).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/players').body as string)).toEqual({
      first_name: 'Sam',
      last_name: 'Taylor',
      date_of_birth: '2013-05-14',
    })
  })

  it('asks for every field before sending', async () => {
    mockBackend(loggedInAs(parentUser))

    renderAt('/parent/players/new', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Add player' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in every field.')
  })

  it('shows the player’s programs and saves edits', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/players/p1': () => jsonResponse({ ...sam, programs: [program] }),
      'PATCH /api/v1/players/p1': () => jsonResponse({ ...sam, first_name: 'Samuel' }),
    })

    renderAt('/parent/players/p1', routes)

    expect(await screen.findByText('U14 Cricket Development')).toBeInTheDocument()
    expect(screen.getByText('Cricket · Under 14 · Coach Chris Lee')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Samuel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'PATCH /api/v1/players/p1').body as string)).toEqual({
      first_name: 'Samuel',
      last_name: 'Taylor',
      date_of_birth: '2013-05-14',
    })
  })

  it('shows the error when the player can’t be found', async () => {
    mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/players/p1': () =>
        jsonResponse({ error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found' } }, 404),
    })

    renderAt('/parent/players/p1', routes)

    expect(await screen.findByRole('alert')).toHaveTextContent('Player not found')
  })
})
