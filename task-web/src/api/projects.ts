import api from './client'
import type { Project, ProjectMember, Label, Paginated, ProjectStats } from '@/types'

export interface CreateProjectInput { name: string; description?: string }
export interface UpdateProjectInput { name?: string; description?: string }
export interface AddMemberInput { email: string; role: string }
export interface CreateLabelInput { name: string; color: string }

export const projectsApi = {
  list: (params?: { cursor?: string; archived?: boolean }) =>
    api.get<Paginated<Project>>('/projects', { params }).then((r) => r.data),
  get: (id: string) => api.get<{ project: Project }>(`/projects/${id}`).then((r) => r.data.project),
  stats: (id: string) => api.get<ProjectStats>(`/projects/${id}/stats`).then((r) => r.data),
  create: (data: CreateProjectInput) => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: UpdateProjectInput) => api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  archive: (id: string) => api.post<{ project: Project }>(`/projects/${id}/archive`).then((r) => r.data),
  unarchive: (id: string) => api.post<{ project: Project }>(`/projects/${id}/unarchive`).then((r) => r.data),

  members: {
    list: (projectId: string) =>
      api.get<{ members: ProjectMember[] }>(`/projects/${projectId}/members`).then((r) => r.data.members),
    add: (projectId: string, data: AddMemberInput) =>
      api.post<ProjectMember>(`/projects/${projectId}/members`, data).then((r) => r.data),
    update: (projectId: string, userId: string, role: string) =>
      api.patch(`/projects/${projectId}/members/${userId}`, { role }).then((r) => r.data),
    remove: (projectId: string, userId: string) =>
      api.delete(`/projects/${projectId}/members/${userId}`).then((r) => r.data),
  },

  labels: {
    list: (projectId: string) =>
      api.get<{ labels: Label[] }>(`/projects/${projectId}/labels`).then((r) => r.data.labels),
    create: (projectId: string, data: CreateLabelInput) =>
      api.post<Label>(`/projects/${projectId}/labels`, data).then((r) => r.data),
    update: (id: string, data: Partial<CreateLabelInput>) =>
      api.patch<Label>(`/labels/${id}`, data).then((r) => r.data),
    delete: (id: string) => api.delete(`/labels/${id}`).then((r) => r.data),
  },
}
