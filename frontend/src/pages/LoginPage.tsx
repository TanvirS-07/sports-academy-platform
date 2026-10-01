import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { homePathFor } from '../auth/types'
import { lift } from '../components/Button'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { FormError, FormField, SubmitButton } from '../components/FormField'
import { errorMessage } from '../lib/errors'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(from ?? homePathFor(user.role), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Log in" description="For parents and coaches of Precision Cricket Academy.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton busy={busy} busyLabel="Logging in…">Log in</SubmitButton>
      </form>
      {import.meta.env.VITE_DEMO === 'true' && (
        <DemoLogins
          onPick={(demoEmail) => {
            setEmail(demoEmail)
            setPassword(DEMO_PASSWORD)
          }}
        />
      )}
      <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
        New parent?{' '}
        <Link to="/register" className="font-semibold text-brand underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}

// Made-up accounts from backend/scripts/seed_demo.py. Only shown on the live demo.
const DEMO_PASSWORD = 'demo-password'
const DEMO_ACCOUNTS = [
  { label: 'Coach', email: 'coach@example.com' },
  { label: 'Parent', email: 'parent@example.com' },
]

function DemoLogins({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="mt-6 rounded-md border border-line bg-subtle px-4 py-3.5 text-sm text-ink-muted">
      <p className="font-semibold text-ink">This is a demo with made-up data</p>
      <p className="mt-1">
        Pick an account to fill in the form. The password for both is <code>{DEMO_PASSWORD}</code>. If nobody has used
        the demo for a while, the first login can take up to a minute while the server wakes up.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account.email)}
            className={`rounded-md border border-line-strong bg-surface px-3 py-1.5 font-medium text-ink hover:border-ink-muted ${lift}`}
          >
            {account.label}: {account.email}
          </button>
        ))}
      </div>
    </div>
  )
}
