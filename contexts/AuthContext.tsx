import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, UserRole } from '../types'
import { API_URL } from '../src/config'

interface AuthResult { success: boolean; message: string; user?: User }

interface AuthContextType {
  currentUser: User | null
  csrfToken: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  googleLogin: (credential: string, platform?: string) => Promise<AuthResult>
  register: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  createOrganization: (companyName: string, timezone: string) => Promise<AuthResult>
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const json = async (response: Response): Promise<Record<string, unknown>> => {
  try { return await response.json() as Record<string, unknown> } catch { return {} }
}
const messageFor = (data: Record<string, unknown>, fallback: string) => typeof data.message === 'string' ? data.message : fallback

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const applySession = useCallback((data: Record<string, unknown>) => {
    const user = data.user as User | undefined
    const csrf = typeof data.csrfToken === 'string' ? data.csrfToken : null
    if (!user || !csrf) throw new Error('The server returned an incomplete session.')
    setCurrentUser(user)
    setCsrfToken(csrf)
    return user
  }, [])

  const apiFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    const method = (init.method || 'GET').toUpperCase()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken)
    return fetch(input, { ...init, headers, credentials: 'same-origin' })
  }, [csrfToken])

  const clearSession = useCallback(() => { setCurrentUser(null); setCsrfToken(null) }, [])

  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/session`, { credentials: 'same-origin' })
        const data = await json(response)
        if (active && response.ok) applySession(data)
      } finally { if (active) setLoading(false) }
    }
    void restore()
    return () => { active = false }
  }, [applySession])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password }),
      })
      const data = await json(response)
      if (!response.ok) return { success: false, message: messageFor(data, 'Unable to sign in.') }
      const user = applySession(data)
      navigate(user.role ? '/dashboard' : '/select-role', { replace: true })
      return { success: true, message: 'Signed in.', user }
    } catch { return { success: false, message: 'Unable to reach the server. Please try again.' } }
  }, [applySession, navigate])

  const googleLogin = useCallback(async (credential: string, platform?: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ credential, platform: platform || 'web' }),
      })
      const data = await json(response)
      if (!response.ok) return { success: false, message: messageFor(data, 'Unable to sign in with Google.') }
      const user = applySession(data)
      navigate(user.role ? '/dashboard' : '/select-role', { replace: true })
      return { success: true, message: 'Signed in.', user }
    } catch { return { success: false, message: 'Unable to reach the server. Please try again.' } }
  }, [applySession, navigate])

  const register = useCallback(async (name: string, email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ name, email, password }),
      })
      const data = await json(response)
      return response.ok ? { success: true, message: messageFor(data, 'Account created.') } : { success: false, message: messageFor(data, 'Unable to create the account.') }
    } catch { return { success: false, message: 'Unable to reach the server. Please try again.' } }
  }, [])

  const createOrganization = useCallback(async (companyName: string, timezone: string): Promise<AuthResult> => {
    try {
      const response = await apiFetch(`${API_URL}/users/role`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: UserRole.MANAGER, companyName, timezone }),
      })
      const data = await json(response)
      if (!response.ok) return { success: false, message: messageFor(data, 'Unable to create the organization.') }
      const user = data.user as User | undefined
      if (!user) return { success: false, message: 'The organization was created, but the session could not be refreshed.' }
      setCurrentUser(user)
      return { success: true, message: messageFor(data, 'Organization created.'), user }
    } catch { return { success: false, message: 'Unable to reach the server. Please try again.' } }
  }, [apiFetch])

  const logout = useCallback(async () => {
    try { await apiFetch(`${API_URL}/auth/logout`, { method: 'POST' }) }
    finally { clearSession(); navigate('/login', { replace: true }) }
  }, [apiFetch, clearSession, navigate])

  const value = useMemo(() => ({ currentUser, csrfToken, loading, login, googleLogin, register, logout, createOrganization, apiFetch }),
    [apiFetch, createOrganization, csrfToken, currentUser, loading, login, logout, register])
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"><p>Loading application…</p></div>
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
