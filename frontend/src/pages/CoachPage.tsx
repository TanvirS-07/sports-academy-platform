import { useState } from 'react'

import { useAuth } from '../auth/useAuth'
import { ButtonLink } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, PanelBody, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { LinkRow, SessionRow } from '../components/SessionRow'
import { usePrograms } from '../features/programs/api'
import { type TrainingSession, useSessions } from '../features/sessions/api'
import { SessionPlaces } from '../features/sessions/SessionPlaces'
import { formatDay } from '../lib/sydneyTime'

export function CoachPage() {
  const { user } = useAuth()
  const programs = usePrograms()
  const sessions = useSessions()

  const nextSession = (programId: string) =>
    sessions.data?.find((session) => session.program.id === programId && session.status === 'SCHEDULED')
  const coming = sessions.data?.slice(0, 4)

  return (
    <>
      <PageHeader
        title="Programs"
        description={user && `Coach ${user.first_name} ${user.last_name}`}
        actions={<ButtonLink to="/coach/programs/new">New program</ButtonLink>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-6">
          <Panel>
            <QueryState isPending={programs.isPending} error={programs.error} />
            {programs.data?.length === 0 && (
              <EmptyState action={<ButtonLink to="/coach/programs/new" variant="secondary">Create a program</ButtonLink>}>
                Create a program, then enrol players into it and add its sessions.
              </EmptyState>
            )}
            <RowList>
              {programs.data?.map((program) => {
                const next = nextSession(program.id)
                return (
                  <LinkRow
                    key={program.id}
                    to={`/coach/programs/${program.id}`}
                    title={program.name}
                    detail={
                      <>
                        {program.age_group}
                        {next && <> · Next session {formatDay(next.starts_at)}</>}
                      </>
                    }
                  />
                )
              })}
            </RowList>
          </Panel>

          {sessions.data && sessions.data.length > 0 && <NextSevenDays sessions={sessions.data} />}
        </div>

        <Panel
          title="Coming up"
          id="coming-up"
          action={
            <ButtonLink to="/calendar" variant="ghost" size="sm">
              See calendar
            </ButtonLink>
          }
        >
          <QueryState isPending={sessions.isPending} error={sessions.error} />
          {coming?.length === 0 && <EmptyState>No sessions scheduled yet.</EmptyState>}
          <RowList>
            {coming?.map((session) => (
              <SessionRow
                key={session.id}
                startsAt={session.starts_at}
                endsAt={session.ends_at}
                to={`/coach/sessions/${session.id}`}
                muted={session.status === 'CANCELLED'}
                detail={session.program.name}
                aside={<SessionPlaces session={session} />}
              />
            ))}
          </RowList>
        </Panel>
      </div>
    </>
  )
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Totals for the coach's sessions that start in the next 7 days. */
function NextSevenDays({ sessions }: { sessions: TrainingSession[] }) {
  // Read the time once, when the panel first shows, so re-renders don't change it.
  const [cutoff] = useState(() => Date.now() + WEEK_MS)
  const week = sessions.filter(
    (session) => session.status === 'SCHEDULED' && new Date(session.starts_at).getTime() < cutoff,
  )
  const booked = week.reduce((total, session) => total + session.booked, 0)
  const left = week.reduce((total, session) => total + session.available, 0)
  const full = week.filter((session) => session.available === 0).length

  const stats = [
    { label: week.length === 1 ? 'Session' : 'Sessions', value: week.length },
    { label: 'Booked', value: booked },
    { label: full > 0 ? `Places left · ${full} full` : 'Places left', value: left },
  ]

  return (
    <Panel title="Next 7 days" id="next-7-days">
      <PanelBody>
        <dl className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm text-ink-muted">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </PanelBody>
    </Panel>
  )
}
