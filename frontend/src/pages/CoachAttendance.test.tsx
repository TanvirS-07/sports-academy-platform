import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { toSydney } from '../lib/sydneyTime'
import { callsTo, coachUser, firstCallTo, jsonResponse, loggedInAs, mockBackend, renderAt } from '../test/utils'
import { CoachPlayerPage } from './CoachPlayerPage'
import { CoachSessionPage } from './CoachSessionPage'
import { ProgramPage } from './ProgramPage'

const routes = [
  { path: '/coach/programs/:programId', element: <ProgramPage /> },
  { path: '/coach/programs/:programId/players/:playerId', element: <CoachPlayerPage /> },
  { path: '/coach/sessions/:sessionId', element: <CoachSessionPage /> },
]

const program = {
  id: 'g1',
  name: 'U14 Cricket Development',
  sport: { id: 's1', name: 'Cricket' },
  age_group: 'Under 14',
  description: '',
  objectives: '',
}

const upcomingSession = {
  id: 'x1',
  program: { id: 'g1', name: 'U14 Cricket Development', coach_name: 'Sam Taylor' },
  starts_at: '2030-11-08T23:00:00Z',
  ends_at: '2030-11-09T00:30:00Z',
  location: 'Main oval',
  capacity: 10,
  booked: 2,
  available: 8,
  status: 'SCHEDULED',
}

const pastSession = {
  ...upcomingSession,
  id: 'x0',
  starts_at: '2026-09-19T00:00:00Z',
  ends_at: '2026-09-19T01:30:00Z',
}

const sam = { id: 'p1', first_name: 'Sam', last_name: 'Taylor' }
const jo = { id: 'p2', first_name: 'Jo', last_name: 'Taylor' }

const enrolment = {
  player_id: 'p1',
  first_name: 'Sam',
  last_name: 'Taylor',
  date_of_birth: '2013-05-14',
  status: 'ACTIVE',
  enrolled_at: '2026-09-01T00:00:00Z',
}

const note = {
  id: 'n1',
  player_id: 'p1',
  program: { id: 'g1', name: 'U14 Cricket Development' },
  coach_id: coachUser.id,
  coach_name: 'Sam Taylor',
  noted_on: '2026-09-20',
  skills: 'Front foot drive',
  improvements: '',
  progress: 'Much better balance',
  created_at: '2026-09-20T01:00:00Z',
  updated_at: '2026-09-20T01:00:00Z',
}

describe('coach attendance and notes', () => {
  afterEach(() => setAccessToken(null))

  it('splits a program’s sessions into upcoming and past, and links to each player', async () => {
    mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([enrolment]),
      'GET /api/v1/sessions?program_id=g1&include_past=true': () => jsonResponse([pastSession, upcomingSession]),
    })

    renderAt('/coach/programs/g1', routes)

    const past = (await screen.findByRole('heading', { name: 'Past sessions' })).closest('section')
    expect(past).not.toBeNull()
    expect(within(past as HTMLElement).getByText('Saturday 19 September, 10:00 am to 11:30 am')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sam Taylor' })).toHaveAttribute('href', '/coach/programs/g1/players/p1')
  })

  it('marks attendance for a session that has started', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/sessions/x0': () => jsonResponse(pastSession),
      'GET /api/v1/sessions/x0/bookings': () => jsonResponse([]),
      'GET /api/v1/sessions/x0/attendance': () =>
        jsonResponse([
          { player: jo, status: null },
          { player: sam, status: 'PRESENT' },
        ]),
      'PUT /api/v1/sessions/x0/attendance': () =>
        jsonResponse([
          { player: jo, status: 'EXCUSED' },
          { player: sam, status: 'PRESENT' },
        ]),
    })

    renderAt('/coach/sessions/x0', routes)

    const samRow = await screen.findByRole('group', { name: 'Sam Taylor' })
    expect(within(samRow).getByRole('radio', { name: 'Present' })).toBeChecked()
    fireEvent.click(within(screen.getByRole('group', { name: 'Jo Taylor' })).getByRole('radio', { name: 'Excused' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }))

    expect(await screen.findByText('Attendance saved.')).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'PUT /api/v1/sessions/x0/attendance').body as string)).toEqual({
      records: [
        { player_id: 'p2', status: 'EXCUSED' },
        { player_id: 'p1', status: 'PRESENT' },
      ],
    })
  })

  it('waits for the session to start before asking for attendance', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/sessions/x1': () => jsonResponse(upcomingSession),
      'GET /api/v1/sessions/x1/bookings': () => jsonResponse([]),
    })

    renderAt('/coach/sessions/x1', routes)

    expect(await screen.findByText('You can mark attendance once the session starts.')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'GET /api/v1/sessions/x1/attendance')).toHaveLength(0)
  })

  it('shows a player’s attendance and notes, and adds a note', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([enrolment]),
      'GET /api/v1/players/p1/attendance?program_id=g1': () =>
        jsonResponse({
          summary: { present: 1, absent: 0, excused: 0, total: 1 },
          records: [{ session: pastSession, status: 'PRESENT' }],
        }),
      'GET /api/v1/players/p1/development-notes?program_id=g1': () =>
        jsonResponse([note, { ...note, id: 'n2', coach_id: 'someone-else', coach_name: 'Chris Lee' }]),
      'POST /api/v1/players/p1/development-notes': () => jsonResponse(note, 201),
    })

    renderAt('/coach/programs/g1/players/p1', routes)

    expect(await screen.findByText('Attended 1 of 1 sessions')).toBeInTheDocument()
    expect(await screen.findAllByText('Front foot drive')).toHaveLength(2)
    // Only the note this coach wrote can be edited.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Areas to improve'), { target: { value: '  Keep the head still ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    await expect.poll(() => callsTo(fetchMock, 'POST /api/v1/players/p1/development-notes').length).toBe(1)
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/players/p1/development-notes').body as string)).toEqual({
      program_id: 'g1',
      noted_on: toSydney(new Date()).date,
      skills: '',
      improvements: 'Keep the head still',
      progress: '',
    })
  })

  it('doesn’t send an empty note', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([enrolment]),
      'GET /api/v1/players/p1/attendance?program_id=g1': () =>
        jsonResponse({ summary: { present: 0, absent: 0, excused: 0, total: 0 }, records: [] }),
      'GET /api/v1/players/p1/development-notes?program_id=g1': () => jsonResponse([]),
    })

    renderAt('/coach/programs/g1/players/p1', routes)
    expect(await screen.findByText('No attendance recorded yet.')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Write something in at least one of the boxes.')
    expect(callsTo(fetchMock, 'POST /api/v1/players/p1/development-notes')).toHaveLength(0)
  })

  it('edits a note the coach wrote', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([enrolment]),
      'GET /api/v1/players/p1/attendance?program_id=g1': () =>
        jsonResponse({ summary: { present: 0, absent: 0, excused: 0, total: 0 }, records: [] }),
      'GET /api/v1/players/p1/development-notes?program_id=g1': () => jsonResponse([note]),
      'PATCH /api/v1/development-notes/n1': () => jsonResponse({ ...note, progress: 'Ready for the next level' }),
    })

    renderAt('/coach/programs/g1/players/p1', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const progress = screen.getAllByLabelText('Progress')[0] as HTMLTextAreaElement
    expect(progress.value).toBe('Much better balance')
    fireEvent.change(progress, { target: { value: 'Ready for the next level' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    await expect.poll(() => callsTo(fetchMock, 'PATCH /api/v1/development-notes/n1').length).toBe(1)
    expect(JSON.parse(firstCallTo(fetchMock, 'PATCH /api/v1/development-notes/n1').body as string)).toEqual({
      noted_on: '2026-09-20',
      skills: 'Front foot drive',
      improvements: '',
      progress: 'Ready for the next level',
    })
  })
})
