import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { callsTo, coachUser, firstCallTo, jsonResponse, loggedInAs, mockBackend, renderAt } from '../test/utils'
import { CoachPage } from './CoachPage'
import { NewProgramPage } from './NewProgramPage'
import { ProgramPage } from './ProgramPage'

const routes = [
  { path: '/coach', element: <CoachPage /> },
  { path: '/coach/programs/new', element: <NewProgramPage /> },
  { path: '/coach/programs/:programId', element: <ProgramPage /> },
]

const cricket = { id: 's1', name: 'Cricket' }
const program = {
  id: 'g1',
  name: 'U14 Cricket Development',
  sport: cricket,
  age_group: 'Under 14',
  description: 'Batting and bowling basics',
  objectives: '',
}
const samEnrolment = {
  player_id: 'p1',
  first_name: 'Sam',
  last_name: 'Taylor',
  date_of_birth: '2013-05-14',
  status: 'ACTIVE',
  enrolled_at: '2026-09-27T00:00:00Z',
}

describe('coach program pages', () => {
  afterEach(() => setAccessToken(null))

  it('lists the coach’s programs', async () => {
    mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs': () => jsonResponse([program]),
      'GET /api/v1/sessions': () => jsonResponse([]),
    })

    renderAt('/coach', routes)

    expect(await screen.findByText('U14 Cricket Development')).toBeInTheDocument()
    expect(screen.getByText('Under 14')).toBeInTheDocument()
    expect(await screen.findByText('No sessions scheduled yet.')).toBeInTheDocument()
  })

  it('adds up the next 7 days and shows only the first 4 sessions', async () => {
    const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const session = (id: string, days: number, booked: number, capacity: number, status = 'SCHEDULED') => ({
      id,
      program: { id: 'g1', name: 'U14 Cricket Development', coach_name: 'Sam Lee' },
      starts_at: inDays(days),
      ends_at: inDays(days + 0.05),
      location: 'Main oval',
      capacity,
      booked,
      available: capacity - booked,
      status,
    })
    mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs': () => jsonResponse([program]),
      'GET /api/v1/sessions': () =>
        jsonResponse([
          session('a', 1, 8, 12),
          session('b', 3, 10, 10),
          session('c', 5, 0, 10, 'CANCELLED'),
          session('d', 10, 4, 12),
          session('e', 12, 2, 12),
        ]),
    })

    renderAt('/coach', routes)

    const week = await screen.findByRole('region', { name: 'Next 7 days' })
    expect(within(week).getByText('Sessions').nextSibling).toHaveTextContent('2')
    expect(within(week).getByText('Booked').nextSibling).toHaveTextContent('18')
    expect(within(week).getByText('Places left · 1 full').nextSibling).toHaveTextContent('4')
    const comingUp = screen.getByRole('region', { name: 'Coming up' })
    expect(within(comingUp).getAllByRole('listitem')).toHaveLength(4)
    expect(within(comingUp).getByRole('link', { name: 'See calendar' })).toHaveAttribute('href', '/calendar')
  })

  it('creates a program with the only sport picked for them', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/sports': () => jsonResponse([cricket]),
      'POST /api/v1/programs': () => jsonResponse(program, 201),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([]),
      'GET /api/v1/sessions?program_id=g1&include_past=true': () => jsonResponse([]),
    })

    renderAt('/coach/programs/new', routes)
    await screen.findByRole('option', { name: 'Cricket' })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'U14 Cricket Development' } })
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'Under 14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create program' }))

    expect(await screen.findByText('/coach/programs/g1')).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/programs').body as string)).toEqual({
      name: 'U14 Cricket Development',
      sport_id: 's1',
      age_group: 'Under 14',
      description: '',
      objectives: '',
    })
  })

  it('shows the roster and makes an enrolment inactive', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([samEnrolment]),
      'GET /api/v1/sessions?program_id=g1&include_past=true': () => jsonResponse([]),
      'PATCH /api/v1/programs/g1/players/p1': () =>
        jsonResponse({ ...samEnrolment, status: 'INACTIVE', date_of_birth: null }),
    })

    renderAt('/coach/programs/g1', routes)

    expect(await screen.findByText('14 May 2013')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Make inactive: Sam Taylor' }))
    expect(screen.getByText('Make Sam inactive? Their upcoming bookings are cancelled.')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'PATCH /api/v1/programs/g1/players/p1')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Make inactive' }))

    await expect.poll(() => callsTo(fetchMock, 'PATCH /api/v1/programs/g1/players/p1').length).toBe(1)
    expect(JSON.parse(firstCallTo(fetchMock, 'PATCH /api/v1/programs/g1/players/p1').body as string)).toEqual({
      status: 'INACTIVE',
    })
  })

  it('searches for a player and enrols them', async () => {
    let roster: unknown[] = []
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse(roster),
      'GET /api/v1/sessions?program_id=g1&include_past=true': () => jsonResponse([]),
      'POST /api/v1/players/search': () =>
        jsonResponse([
          { id: 'p1', first_name: 'Sam', last_name: 'Taylor', parent_first_names: ['Alex'] },
          { id: 'p2', first_name: 'Sam', last_name: 'Taylor', parent_first_names: ['Priya'] },
        ]),
      'POST /api/v1/programs/g1/players': () => {
        roster = [samEnrolment]
        return jsonResponse(samEnrolment, 201)
      },
    })

    renderAt('/coach/programs/g1', routes)
    fireEvent.change(await screen.findByLabelText('Player name'), { target: { value: 'sam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Parent: Alex')).toBeInTheDocument()
    expect(screen.getByText('Parent: Priya')).toBeInTheDocument()

    const [firstEnrol] = screen.getAllByRole('button', { name: 'Enrol Sam Taylor' })
    fireEvent.click(firstEnrol!)

    const players = await screen.findByRole('button', { name: 'Make inactive: Sam Taylor' })
    expect(within(players.closest('tr')!).getByText('14 May 2013')).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/players/search').body as string)).toEqual({
      query: 'sam',
    })
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/programs/g1/players').body as string)).toEqual({
      player_id: 'p1',
    })
    expect(screen.getByText('Enrolled')).toBeInTheDocument()
  })
})
