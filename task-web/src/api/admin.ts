import api from './client'
import type { AdminUser, AdminStats } from '@/types'

export interface AdminUsersParams {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'active' | 'deleted'
}

export interface AdminUsersResponse {
  items: AdminUser[]
  total: number
  page: number
  limit: number
}

export const adminApi = {
  getStats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),
  listUsers: (params?: AdminUsersParams) =>
    api.get<AdminUsersResponse>('/admin/users', { params }).then((r) => r.data),
}
