import { useAuth } from '../auth/useAuth'
import { ButtonLink } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Panel, RowList } from '../components/Panel'
import { QueryState } from '../components/QueryState'
import { LinkRow, SessionRow } from '../components/SessionRow'
import { usePrograms } from '../features/programs/api'
import { useSessions } from '../features/sessions/api'
import { SessionPlaces } from '../features/sessions/SessionPlaces'
import { formatDay } from '../lib/sydneyTime'

export function CoachPage() {
  const { user } = useAuth()
  const programs = usePrograms()
  const sessions = useSessions()

  const nextSession = (programId: string) =>
    sessions.data?.find((session) => session.program.id === programId && session.status === 'SCHEDULED')
  const coming = sessions.data?.slice(0, 6)

  return (
    <>
      <PageHeader
        title="Programs"
        description={user && `Coach ${user.first_name} ${user.last_name}`}
        actions={<ButtonLink to="/coach/programs/new">New program</ButtonLink>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
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

        <Panel title="Coming up" id="coming-up">
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
