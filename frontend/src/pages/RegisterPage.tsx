import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { homePathFor } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { FormError, FormField, SubmitButton } from '../components/FormField'
import { errorMessage } from '../lib/errors'

const MIN_PASSWORD_LENGTH = 8

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(field: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const user = await register(form)
      navigate(homePathFor(user.role), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Create a parent account"
      description="Coach accounts are set up by the academy."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" name="first_name" autoComplete="given-name" required
            value={form.first_name} onChange={update('first_name')} />
          <FormField label="Last name" name="last_name" autoComplete="family-name" required
            value={form.last_name} onChange={update('last_name')} />
        </div>
        <FormField label="Email" name="email" type="email" autoComplete="email" required
          value={form.email} onChange={update('email')} />
        <FormField label="Password" name="password" type="password" autoComplete="new-password"
          required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={form.password} onChange={update('password')} />
        <SubmitButton busy={busy} busyLabel="Creating account…">Create account</SubmitButton>
      </form>
      <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
