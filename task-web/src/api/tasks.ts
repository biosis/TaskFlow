import api from './client'
import type { Task, Comment, Attachment, Paginated, TaskStatus, TaskPriority } from '@/types'

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  assigneeIds?: string[]
  labelIds?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  position?: number
  dueDate?: string | null
}

export type TaskSort = 'position' | 'createdAt' | 'movedAt' | 'dueDate' | 'priority'

export interface ListTasksParams {
  cursor?: string
  limit?: number
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  labelId?: string
  search?: string
  sort?: TaskSort
  archived?: 'exclude' | 'include' | 'only'
}

export const tasksApi = {
  list: (projectId: string, params?: ListTasksParams) =>
    api.get<Paginated<Task>>(`/projects/${projectId}/tasks`, { params }).then((r) => r.data),
  get: (id: string) => api.get<{ task: Task }>(`/tasks/${id}`).then((r) => r.data.task),
  create: (projectId: string, data: CreateTaskInput) =>
    api.post<{ task: Task }>(`/projects/${projectId}/tasks`, data).then((r) => r.data.task),
  update: (id: string, data: UpdateTaskInput) =>
    api.patch<{ task: Task }>(`/tasks/${id}`, data).then((r) => r.data.task),
  delete: (id: string) => api.delete(`/tasks/${id}`).then((r) => r.data),

  assignees: {
    add: (taskId: string, userId: string) =>
      api.post(`/tasks/${taskId}/assignees`, { userId }).then((r) => r.data),
    remove: (taskId: string, userId: string) =>
      api.delete(`/tasks/${taskId}/assignees/${userId}`).then((r) => r.data),
  },

  labels: {
    add: (taskId: string, labelId: string) =>
      api.post(`/tasks/${taskId}/labels`, { labelId }).then((r) => r.data),
    remove: (taskId: string, labelId: string) =>
      api.delete(`/tasks/${taskId}/labels/${labelId}`).then((r) => r.data),
  },

  archive: (id: string) =>
    api.post<{ task: Task }>(`/tasks/${id}/archive`).then((r) => r.data.task),
  unarchive: (id: string) =>
    api.post<{ task: Task }>(`/tasks/${id}/unarchive`).then((r) => r.data.task),
  archiveOld: (projectId: string) =>
    api.post<{ archivedCount: number }>(`/projects/${projectId}/tasks/archive-old`).then((r) => r.data),

  move: (id: string, projectId: string) =>
    api.patch<{ task: Task }>(`/tasks/${id}/move`, { projectId }).then((r) => r.data.task),

  comments: {
    list: (taskId: string) =>
      api.get<{ items: Comment[]; nextCursor: string | null }>(`/tasks/${taskId}/comments`).then((r) => r.data.items),
    create: (taskId: string, body: string) =>
      api.post<Comment>(`/tasks/${taskId}/comments`, { body }).then((r) => r.data),
    update: (taskId: string, commentId: string, body: string) =>
      api.patch<Comment>(`/tasks/${taskId}/comments/${commentId}`, { body }).then((r) => r.data),
    delete: (taskId: string, commentId: string) =>
      api.delete(`/tasks/${taskId}/comments/${commentId}`).then((r) => r.data),
  },

  subtasks: {
    list: (taskId: string) =>
      api.get<{ items: Task[]; nextCursor: string | null }>(`/tasks/${taskId}/subtasks`).then((r) => r.data.items),
    create: (projectId: string, taskId: string, title: string) =>
      api.post<{ task: Task }>(`/projects/${projectId}/tasks`, { title, parentId: taskId }).then((r) => r.data.task),
    update: (subtaskId: string, data: { title?: string; status?: TaskStatus }) =>
      api.patch<{ task: Task }>(`/tasks/${subtaskId}`, data).then((r) => r.data.task),
    delete: (subtaskId: string) => api.delete(`/tasks/${subtaskId}`).then((r) => r.data),
  },

  attachments: {
    list: (taskId: string) =>
      api.get<{ attachments: Attachment[] }>(`/tasks/${taskId}/attachments`).then((r) => r.data.attachments),
    upload: (taskId: string, file: File, onProgress?: (pct: number) => void) => {
      const form = new FormData()
      form.append('file', file)
      return api
        .post<{ attachment: Attachment }>(`/tasks/${taskId}/attachments`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
          },
        })
        .then((r) => r.data.attachment)
    },
    download: (attachmentId: string) =>
      api.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),
    delete: (attachmentId: string) => api.delete(`/attachments/${attachmentId}`).then((r) => r.data),
  },
}
