import { useNavigate } from 'react-router'

import { PageHeader } from '../components/PageHeader'
import { Panel, PanelBody } from '../components/Panel'
import { useCreatePlayer } from '../features/players/api'
import { PlayerForm } from '../features/players/PlayerForm'

export function NewPlayerPage() {
  const createPlayer = useCreatePlayer()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        back={{ label: 'Home', to: '/parent' }}
        title="Add a player"
        description="Add your child, then their coach can enrol them in a program."
      />
      <Panel className="max-w-2xl">
        <PanelBody className="py-6 sm:px-6">
          <PlayerForm
            submitLabel="Add player"
            onCancel={() => navigate('/parent')}
            onSubmit={async (data) => {
              const player = await createPlayer.mutateAsync(data)
              navigate(`/parent/players/${player.id}`, { replace: true })
            }}
          />
        </PanelBody>
      </Panel>
    </>
  )
}
