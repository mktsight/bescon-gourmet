import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchUserAttributes,
  type AuthUser,
} from 'aws-amplify/auth'

interface UserProfile {
  userId: string
  email: string
  name: string
  gender?: string
  ageGroup?: string
}

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (params: RegisterParams) => Promise<{ nextStep: string }>
  confirmEmail: (email: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

interface RegisterParams {
  email: string
  password: string
  name: string
  gender: string
  ageGroup: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    try {
      const cognitoUser: AuthUser = await getCurrentUser()
      const attrs = await fetchUserAttributes()
      setUser({
        userId: cognitoUser.userId,
        email: attrs.email ?? '',
        name: attrs.name ?? '',
        gender: attrs['custom:gender'],
        ageGroup: attrs['custom:agegroup'],
      })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(email: string, password: string) {
    await signIn({ username: email, password })
    await loadCurrentUser()
  }

  async function register({ email, password, name, gender, ageGroup }: RegisterParams) {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
          'custom:gender': gender,
          'custom:agegroup': ageGroup,
        },
      },
    })
    return { nextStep: result.nextStep.signUpStep }
  }

  async function confirmEmail(email: string, code: string) {
    await confirmSignUp({ username: email, confirmationCode: code })
  }

  async function logout() {
    await signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, confirmEmail, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
