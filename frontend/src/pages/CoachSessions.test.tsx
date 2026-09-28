import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { setAccessToken } from '../lib/api'
import { callsTo, coachUser, firstCallTo, jsonResponse, loggedInAs, mockBackend, renderAt } from '../test/utils'
import { CoachSessionPage } from './CoachSessionPage'
import { NewSessionPage } from './NewSessionPage'
import { ProgramPage } from './ProgramPage'

const routes = [
  { path: '/coach/programs/:programId', element: <ProgramPage /> },
  { path: '/coach/programs/:programId/sessions/new', element: <NewSessionPage /> },
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

const samBooking = {
  id: 'b1',
  player: { id: 'p1', first_name: 'Sam', last_name: 'Taylor' },
  created_at: '2030-10-01T00:00:00Z',
}

function fillForm(values: { date: string; start: string; end: string }) {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: values.date } })
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: values.start } })
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: values.end } })
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Main oval' } })
  fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '10' } })
}

describe('coach session pages', () => {
  afterEach(() => setAccessToken(null))

  it('lists a program’s sessions in Sydney time with places left', async () => {
    mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/programs/g1': () => jsonResponse(program),
      'GET /api/v1/programs/g1/players': () => jsonResponse([]),
      'GET /api/v1/sessions?program_id=g1&include_past=true': () => jsonResponse([session]),
    })

    renderAt('/coach/programs/g1', routes)

    expect(await screen.findByText('Saturday 9 November, 10:00 am to 11:30 am')).toBeInTheDocument()
    expect(screen.getByText('Main oval · 7 of 10 booked, 3 left')).toBeInTheDocument()
  })

  it('creates a session and sends the times in UTC', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'POST /api/v1/sessions': () => jsonResponse({ ...session, booked: 0, available: 10 }, 201),
      'GET /api/v1/sessions/x1': () => jsonResponse(session),
      'GET /api/v1/sessions/x1/bookings': () => jsonResponse([]),
    })

    renderAt('/coach/programs/g1/sessions/new', routes)
    fillForm({ date: '2030-11-09', start: '10:00', end: '11:30' })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    expect(await screen.findByText('/coach/sessions/x1')).toBeInTheDocument()
    expect(JSON.parse(firstCallTo(fetchMock, 'POST /api/v1/sessions').body as string)).toEqual({
      program_id: 'g1',
      starts_at: '2030-11-08T23:00:00.000Z',
      ends_at: '2030-11-09T00:30:00.000Z',
      location: 'Main oval',
      capacity: 10,
    })
  })

  it('checks the times before sending anything', async () => {
    const fetchMock = mockBackend(loggedInAs(coachUser))

    renderAt('/coach/programs/g1/sessions/new', routes)
    await screen.findByLabelText('Date')
    fillForm({ date: '2030-10-05', start: '11:00', end: '10:00' })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The end time must be after the start time.')

    // The clocks go forward at 2:00 am on 6 October 2030, so 2:30 am doesn't exist.
    fillForm({ date: '2030-10-06', start: '02:30', end: '04:00' })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('daylight saving')

    expect(callsTo(fetchMock, 'POST /api/v1/sessions')).toHaveLength(0)
  })

  it('shows who is booked and cancels a booking', async () => {
    let bookings = [samBooking]
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/sessions/x1': () => jsonResponse(session),
      'GET /api/v1/sessions/x1/bookings': () => jsonResponse(bookings),
      'POST /api/v1/bookings/b1/cancel': () => {
        bookings = []
        return jsonResponse({ ...samBooking, status: 'CANCELLED', session })
      },
    })

    renderAt('/coach/sessions/x1', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel booking: Sam Taylor' }))

    expect(await screen.findByText('Nobody has booked yet.')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'POST /api/v1/bookings/b1/cancel')).toHaveLength(1)
  })

  it('asks before cancelling the session', async () => {
    const fetchMock = mockBackend({
      ...loggedInAs(coachUser),
      'GET /api/v1/sessions/x1': () => jsonResponse(session),
      'GET /api/v1/sessions/x1/bookings': () => jsonResponse([]),
      'POST /api/v1/sessions/x1/cancel': () => jsonResponse({ ...session, status: 'CANCELLED' }),
    })

    renderAt('/coach/sessions/x1', routes)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel session' }))
    expect(callsTo(fetchMock, 'POST /api/v1/sessions/x1/cancel')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    await expect.poll(() => callsTo(fetchMock, 'POST /api/v1/sessions/x1/cancel').length).toBe(1)
  })
})
