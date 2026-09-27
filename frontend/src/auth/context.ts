import { createContext } from 'react'

import type { RegisterData, User } from './types'

export type AuthContextValue = {
  user: User | null
  /** True while the app is checking the refresh cookie on first load. */
  restoring: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: RegisterData) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
