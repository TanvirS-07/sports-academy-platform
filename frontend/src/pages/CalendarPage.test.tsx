import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { coachUser, jsonResponse, loggedInAs, mockBackend, parentUser, renderAt } from '../test/utils'
import { CalendarPage } from './CalendarPage'

const routes = [{ path: '/calendar', element: <CalendarPage /> }]

// Tomorrow, so the session is always in the first view.
const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
const session = {
  id: 'x1',
  program: { id: 'g1', name: 'U14 Cricket Development', coach_name: 'Chris Lee' },
  starts_at: startsAt.toISOString(),
  ends_at: new Date(startsAt.getTime() + 90 * 60 * 1000).toISOString(),
  location: 'Main oval',
  capacity: 10,
  booked: 7,
  available: 3,
  status: 'SCHEDULED',
}

describe('calendar', () => {
  afterEach(() => setAccessToken(null))

  it('shows a coach’s upcoming sessions linked to each session page', async () => {
    mockBackend({ ...loggedInAs(coachUser), 'GET /api/v1/sessions': () => jsonResponse([session]) })

    renderAt('/calendar', routes)

    const links = await screen.findAllByRole('link', { name: /U14 Cricket Development/ })
    expect(links[0]).toHaveAttribute('href', '/coach/sessions/x1')
    expect(screen.getByRole('list', { name: 'Programs' })).toHaveTextContent('U14 Cricket Development')
  })

  it('marks the sessions a parent has booked', async () => {
    mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/sessions': () => jsonResponse([session]),
      'GET /api/v1/bookings': () =>
        jsonResponse([
          {
            id: 'b1',
            status: 'CONFIRMED',
            player: { id: 'p1', first_name: 'Sam', last_name: 'Taylor' },
            session,
            created_at: '2026-09-01T00:00:00Z',
            cancelled_at: null,
          },
        ]),
    })

    renderAt('/calendar', routes)

    expect(await screen.findByText('Sam booked')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /U14 Cricket Development/ })[0]).toHaveAttribute(
      'href',
      '/parent/sessions',
    )
  })

  it('moves between months', async () => {
    mockBackend({ ...loggedInAs(coachUser), 'GET /api/v1/sessions': () => jsonResponse([]) })

    renderAt('/calendar', routes)
    const title = (await screen.findByRole('heading', { level: 1 })).textContent

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(title)
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title ?? '')
  })
})
