import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { callsTo, firstCallTo, jsonResponse, loggedInAs, mockBackend, parentUser, renderAt } from '../test/utils'
import { ParentSessionsPage } from './ParentSessionsPage'
import { PlayerPage } from './PlayerPage'

const routes = [
  { path: '/parent/sessions', element: <ParentSessionsPage /> },
  { path: '/parent/players/:playerId', element: <PlayerPage /> },
]

const program = { id: 'g1', name: 'U14 Cricket Development', sport: 'Cricket', age_group: 'Under 14', coach_name: 'Chris Lee' }
const sam = { id: 'p1', first_name: 'Sam', last_name: 'Taylor', date_of_birth: '2013-05-14' }
const kim = { id: 'p2', first_name: 'Kim', last_name: 'Taylor', date_of_birth: '2016-02-01' }

const session = {
  id: 'x1',
  program: { id: 'g1', name: 'U14 Cricket Development', coach_name: 'Chris Lee' },
  starts_at: '2030-11-08T23:00:00Z',
  ends_at: '2030-11-09T00:30:00Z',
  location: 'Main oval',
  capacity: 10,
  booked: 7,
  available: 3,
  status: 'SCHEDULED',
}

function booking(status: 'CONFIRMED' | 'CANCELLED', sessionOverrides = {}) {
  return {
    id: 'b1',
    status,
    player: { id: 'p1', first_name: 'Sam', last_name: 'Taylor' },
    session: { ...session, ...sessionOverrides },
    created_at: '2030-11-01T00:00:00Z',
    cancelled_at: status === 'CANCELLED' ? '2030-11-02T00:00:00Z' : null,
  }
}

function familyHandlers() {
  return {
    ...loggedInAs(parentUser),
    'GET /api/v1/players': () => jsonResponse([sam, kim]),
    'GET /api/v1/players/p1': () => jsonResponse({ ...sam, programs: [program] }),
    // Kim isn't in the program, so she can't book this session.
    'GET /api/v1/players/p2': () => jsonResponse({ ...kim, programs: [] }),
  }
}

describe('parent booking pages', () => {
  afterEach(() => setAccessToken(null))

  it('books a child who is in the session’s program', async () => {
    let bookings: unknown[] = []
    const fetchMock = mockBackend({
      ...familyHandlers(),
      'GET /api/v1/sessions': () => jsonResponse([session]),
      'GET /api/v1/bookings': () => jsonResponse(bookings),
      'POST /api/v1/sessions/x1/bookings': () => {
        bookings = [booking('CONFIRMED')]
        return jsonResponse(bookings[0], 201)
      },
    })

    renderAt('/parent/sessions', routes)

    expect(await screen.findByText('Saturday 9 November, 10:00 am to 11:30 am')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Book Sam' }))

    expect(await screen.findByText('Sam: booked')).toBeInTheDocument()
    expect(screen.queryByText(/Kim/)).not.toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/sessions/x1/bookings').body as string)).toEqual({
      player_id: 'p1',
    })
  })

  it('shows a full session and the reason when booking fails', async () => {
    mockBackend({
      ...familyHandlers(),
      'GET /api/v1/sessions': () => jsonResponse([{ ...session, booked: 10, available: 0 }]),
      'GET /api/v1/bookings': () => jsonResponse([]),
    })

    renderAt('/parent/sessions', routes)

    expect(await screen.findByText(/Full \(10 of 10 booked\)/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Book Sam' })).toBeDisabled()
  })

  it('shows the error when someone else took the last place first', async () => {
    mockBackend({
      ...familyHandlers(),
      'GET /api/v1/sessions': () => jsonResponse([{ ...session, booked: 9, available: 1 }]),
      'GET /api/v1/bookings': () => jsonResponse([]),
      'POST /api/v1/sessions/x1/bookings': () =>
        jsonResponse({ error: { code: 'SESSION_FULL', message: 'This session is full' } }, 409),
    })

    renderAt('/parent/sessions', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Book Sam' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This session is full')
  })

  it('lists a child’s bookings and cancels one', async () => {
    let bookings = [booking('CONFIRMED')]
    const fetchMock = mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/players/p1': () => jsonResponse({ ...sam, programs: [program] }),
      'GET /api/v1/bookings?player_id=p1': () => jsonResponse(bookings),
      'POST /api/v1/bookings/b1/cancel': () => {
        bookings = [booking('CANCELLED')]
        return jsonResponse(bookings[0])
      },
    })

    renderAt('/parent/players/p1', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel booking' }))

    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'POST /api/v1/bookings/b1/cancel')).toHaveLength(1)
  })

  it('says when the coach cancelled the session', async () => {
    mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/players/p1': () => jsonResponse({ ...sam, programs: [program] }),
      'GET /api/v1/bookings?player_id=p1': () =>
        jsonResponse([booking('CANCELLED', { status: 'CANCELLED', booked: 0, available: 10 })]),
    })

    renderAt('/parent/players/p1', routes)

    expect(await screen.findByText('Session cancelled')).toBeInTheDocument()
  })
})
