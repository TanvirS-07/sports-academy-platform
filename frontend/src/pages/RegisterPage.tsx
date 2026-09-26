import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { homePathFor } from '../auth/types'
import { useAuth } from '../auth/useAuth'
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
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Create a parent account</h1>
        <p className="text-sm text-slate-600">Coach accounts are set up by the academy.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
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
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-emerald-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
