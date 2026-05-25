import { create } from 'zustand'
import type { User } from '@/types'
import { setAccessToken } from '@/api/client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  setUser: (user: User) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, token) => {
    setAccessToken(token)
    set({ user, isAuthenticated: true, isLoading: false })
  },
  setUser: (user) => set({ user }),
  clearAuth: () => {
    setAccessToken(null)
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
  setLoading: (v) => set({ isLoading: v }),
}))
