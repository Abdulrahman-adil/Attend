import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { User, UserRole } from '../types'
import { API_URL } from '../src/config'

interface AuthResult {
  success: boolean
  message: string
  user?: User
}

interface AuthContextType {
  currentUser: User | null
  token: string | null
  loading: boolean
  login: (name: string, password: string) => Promise<AuthResult>
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>
  logout: () => void
  updateUserRole: (
    role: UserRole,
  ) => Promise<{ success: boolean; message: string }>
  handleAuthSuccess: (token: string, user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('authToken'),
  )
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const logout = useCallback(() => {
    setCurrentUser(null)
    setToken(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (token) {
      const storedUser = localStorage.getItem('currentUser')
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          setCurrentUser(user)
          if (
            user &&
            !user.role &&
            !location.pathname.startsWith('/activate') &&
            location.pathname !== '/select-role' &&
            !location.pathname.startsWith('/auth/callback')
          ) {
            navigate('/select-role', { replace: true })
          }
        } catch (e) {
          console.error('Failed to parse user from local storage', e)
          logout()
        }
      } else {
        logout()
      }
    }
    setLoading(false)
  }, [token, navigate, location.pathname, logout])

  const handleAuthSuccess = (token: string, user: User) => {
    localStorage.setItem('authToken', token)
    localStorage.setItem('currentUser', JSON.stringify(user))
    setToken(token)
    setCurrentUser(user)
    if (user && !user.role) {
      navigate('/select-role', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  const login = async (name: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Login failed')
      handleAuthSuccess(data.token, data.user)
      return { success: true, message: 'Login successful', user: data.user }
    } catch (err) {
      if (err instanceof Error) {
        return { success: false, message: err.message }
      } else {
        return { success: false, message: 'An unknown error occurred' }
      }
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Registration failed')
      return { success: true, message: data.message }
    } catch (err) {
      if (err instanceof Error) {
        return { success: false, message: err.message }
      } else {
        return { success: false, message: 'An unknown error occurred' }
      }
    }
  }

  const updateUserRole = async (role: UserRole) => {
    if (!token) return { success: false, message: 'Not authenticated' }
    try {
      const response = await fetch(`${API_URL}/users/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to update role')
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          role: data.role,
          companyId: data.companyId || currentUser.companyId,
        }
        setCurrentUser(updatedUser)
        localStorage.setItem('currentUser', JSON.stringify(updatedUser))
      }
      return { success: true, message: data.message }
    } catch (err) {
      if (err instanceof Error) {
        return { success: false, message: err.message }
      } else {
        return { success: false, message: 'An unknown error occurred' }
      }
    }
  }

  const value = {
    currentUser,
    token,
    loading,
    login,
    register,
    logout,
    updateUserRole,
    handleAuthSuccess,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <p className="text-white">Loading Application...</p>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
