import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { fullText, jsonResponse, loggedInAs, mockBackend, noProgressYet, parentUser, renderAt } from '../test/utils'
import { PlayerPage } from './PlayerPage'

const routes = [{ path: '/parent/players/:playerId', element: <PlayerPage /> }]

const sam = { id: 'p1', first_name: 'Sam', last_name: 'Taylor', date_of_birth: '2013-05-14', programs: [] }

const session = {
  id: 'x0',
  program: { id: 'g1', name: 'U14 Cricket Development' },
  starts_at: '2026-09-19T00:00:00Z',
  ends_at: '2026-09-19T01:30:00Z',
  location: 'Main oval',
}

describe('parent progress', () => {
  afterEach(() => setAccessToken(null))

  it('shows a child’s attendance and development notes', async () => {
    mockBackend({
      ...loggedInAs(parentUser),
      'GET /api/v1/players/p1': () => jsonResponse(sam),
      'GET /api/v1/bookings?player_id=p1': () => jsonResponse([]),
      'GET /api/v1/players/p1/attendance': () =>
        jsonResponse({
          summary: { present: 1, absent: 1, excused: 0, total: 2 },
          records: [
            { session: { ...session, id: 'x1', starts_at: '2026-09-26T00:00:00Z', ends_at: '2026-09-26T01:30:00Z' }, status: 'ABSENT' },
            { session, status: 'PRESENT' },
          ],
        }),
      'GET /api/v1/players/p1/development-notes': () =>
        jsonResponse([
          {
            id: 'n1',
            player_id: 'p1',
            program: { id: 'g1', name: 'U14 Cricket Development' },
            coach_id: 'c1',
            coach_name: 'Chris Lee',
            noted_on: '2026-09-20',
            skills: 'Front foot drive',
            improvements: 'Keep the head still',
            progress: '',
            created_at: '2026-09-20T01:00:00Z',
            updated_at: '2026-09-20T01:00:00Z',
          },
        ]),
    })

    renderAt('/parent/players/p1', routes)

    expect(await screen.findByText('Attended 1 of 2 sessions')).toBeInTheDocument()
    expect(screen.getByText(fullText('Saturday 26 September, 10:00 am to 11:30 am'))).toBeInTheDocument()
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.getAllByText('U14 Cricket Development · Main oval')).toHaveLength(2)
    expect(await screen.findByText('Front foot drive')).toBeInTheDocument()
    expect(screen.getByText('Coach Chris Lee')).toBeInTheDocument()
    expect(screen.getAllByText('U14 Cricket Development').length).toBeGreaterThan(0)
    expect(screen.getByText('Areas to improve')).toBeInTheDocument()
    expect(screen.queryByText('Progress')).not.toBeInTheDocument()
    // Only the "Edit" for the child's profile. Parents can't change notes.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
  })

  it('says when there’s nothing yet', async () => {
    mockBackend({
      ...loggedInAs(parentUser),
      ...noProgressYet,
      'GET /api/v1/players/p1': () => jsonResponse(sam),
      'GET /api/v1/bookings?player_id=p1': () => jsonResponse([]),
    })

    renderAt('/parent/players/p1', routes)

    expect(await screen.findByText('No attendance recorded yet.')).toBeInTheDocument()
    expect(await screen.findByText('No development notes yet.')).toBeInTheDocument()
  })
})
