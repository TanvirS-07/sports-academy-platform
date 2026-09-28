import { useNavigate, useParams } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Panel, PanelBody } from '../components/Panel'
import { useProgram } from '../features/programs/api'
import { useCreateSession } from '../features/sessions/api'
import { SessionForm } from '../features/sessions/SessionForm'

export function NewSessionPage() {
  const { programId = '' } = useParams()
  const program = useProgram(programId)
  const createSession = useCreateSession()
  const navigate = useNavigate()
  const programPath = `/coach/programs/${programId}`

  return (
    <>
      <PageHeader
        back={{ label: program.data?.name ?? 'Back to program', to: programPath }}
        title="New session"
        description="Parents in this program can book it as soon as it’s created."
      />
      <Panel className="max-w-2xl">
        <PanelBody className="py-6 sm:px-6">
          <SessionForm
            submitLabel="Create session"
            onCancel={() => navigate(programPath)}
            onSubmit={async (data) => {
              const session = await createSession.mutateAsync({ ...data, program_id: programId })
              navigate(`/coach/sessions/${session.id}`, { replace: true })
            }}
          />
        </PanelBody>
      </Panel>
    </>
  )
}
