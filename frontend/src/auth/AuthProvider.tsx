import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { apiGet, apiPost, setAccessToken, setUnauthorizedHandler } from '../lib/api'
import { AuthContext, type AuthContextValue } from './context'
import type { RegisterData, TokenResponse, User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const logout = useCallback(() => {
    // Phase 2 logout only forgets the token in the browser. Server-side
    // revocation comes with refresh tokens in Phase 2b.
    setAccessToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const token = await apiPost<TokenResponse>('/auth/login', { email, password })
    setAccessToken(token.access_token)
    try {
      const me = await apiGet<User>('/users/me')
      setUser(me)
      return me
    } catch (error) {
      setAccessToken(null)
      throw error
    }
  }, [])

  const register = useCallback(
    async (data: RegisterData) => {
      await apiPost<User>('/auth/register', data)
      return login(data.email, data.password)
    },
    [login],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, register, logout }),
    [user, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
