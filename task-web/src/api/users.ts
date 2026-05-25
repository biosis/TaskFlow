import api from './client'
import type { User } from '@/types'

export interface UpdateMeInput {
  displayName?: string
  avatarUrl?: string | null
  archiveThresholdDays?: number
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export const usersApi = {
  updateMe: (data: UpdateMeInput) =>
    api.patch<{ user: User }>('/users/me', data).then((r) => r.data.user),
  changePassword: (data: ChangePasswordInput) =>
    api.post('/users/me/password', data),
  deleteMe: (password: string) =>
    api.delete('/users/me', { data: { password } }),
}
