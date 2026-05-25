import api from './client'
import type { AuthResponse, User } from '@/types'

export interface LoginInput { email: string; password: string }
export interface RegisterInput { email: string; password: string; displayName: string }

export const authApi = {
  login: (data: LoginInput) => api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  register: (data: RegisterInput) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  refresh: () => api.post<{ accessToken: string }>('/auth/refresh').then((r) => r.data),
}
