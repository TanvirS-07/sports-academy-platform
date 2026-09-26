import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { homePathFor } from '../auth/types'
import { useAuth } from '../auth/useAuth'
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
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
        <SubmitButton busy={busy}>Log in</SubmitButton>
      </form>
      <p className="text-sm text-slate-600">
        New parent?{' '}
        <Link to="/register" className="font-medium text-emerald-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
