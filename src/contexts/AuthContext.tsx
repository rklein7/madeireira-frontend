import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { api, TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/lib/api'

export interface User {
  id?: string // UUID
  nome: string
  email: string
  perfil: string
}

interface LoginResponse {
  token: string
  id?: string // UUID
  nome: string
  email: string
  perfil: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [user, setUser] = useState<User | null>(readStoredUser)

  const login = useCallback(async (email: string, senha: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      senha,
    })

    const loggedUser: User = {
      id: data.id,
      nome: data.nome,
      email: data.email,
      perfil: data.perfil,
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedUser))
    setToken(data.token)
    setUser(loggedUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setToken(null)
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [user, token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return context
}
