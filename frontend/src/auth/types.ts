export type Role = 'COACH' | 'PARENT' | 'PLAYER'

export type User = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: Role
  created_at: string
}

export type RegisterData = {
  email: string
  password: string
  first_name: string
  last_name: string
}

export type TokenResponse = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
}

/** Where each role lands after logging in. */
export function homePathFor(role: Role): string {
  if (role === 'COACH') return '/coach'
  if (role === 'PARENT') return '/parent'
  return '/account'
}
