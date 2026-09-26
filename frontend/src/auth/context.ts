import { createContext } from 'react'

import type { RegisterData, User } from './types'

export type AuthContextValue = {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  register: (data: RegisterData) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
