import { useNavigate } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Panel, PanelBody } from '../components/Panel'
import { useCreateProgram } from '../features/programs/api'
import { ProgramForm } from '../features/programs/ProgramForm'

export function NewProgramPage() {
  const createProgram = useCreateProgram()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        back={{ label: 'Programs', to: '/coach' }}
        title="New program"
        description="A group of players you coach together, like an age group or squad."
      />
      <Panel className="max-w-2xl">
        <PanelBody className="py-6 sm:px-6">
          <ProgramForm
            submitLabel="Create program"
            onCancel={() => navigate('/coach')}
            onSubmit={async (data) => {
              const program = await createProgram.mutateAsync(data)
              navigate(`/coach/programs/${program.id}`, { replace: true })
            }}
          />
        </PanelBody>
      </Panel>
    </>
  )
}
