import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { apiGet, apiPost, refreshAccessToken, setAccessToken, setUnauthorizedHandler } from '../lib/api'
import { AuthContext, type AuthContextValue } from './context'
import type { RegisterData, TokenResponse, User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [restoring, setRestoring] = useState(true)
  const queryClient = useQueryClient()

  const forgetUser = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    // Drop cached data so the next person to log in on this browser can't see it.
    queryClient.clear()
  }, [queryClient])

  const logout = useCallback(async () => {
    forgetUser()
    try {
      await apiPost<void>('/auth/logout', undefined)
    } catch {
      // Already logged out in this tab. The cookie expires on its own if this failed.
    }
  }, [forgetUser])

  useEffect(() => {
    setUnauthorizedHandler(forgetUser)
    return () => setUnauthorizedHandler(null)
  }, [forgetUser])

  // On first load, use the refresh cookie (if there is one) to log back in.
  useEffect(() => {
    let cancelled = false

    async function restoreLogin() {
      try {
        if (!(await refreshAccessToken())) return
        const me = await apiGet<User>('/users/me')
        if (!cancelled) setUser(me)
      } catch {
        setAccessToken(null)
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    void restoreLogin()
    return () => {
      cancelled = true
    }
  }, [])

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
    () => ({ user, restoring, login, register, logout }),
    [user, restoring, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
