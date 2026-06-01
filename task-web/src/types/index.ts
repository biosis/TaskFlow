export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  archiveThresholdDays: number
  theme?: string | null
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
  _count?: { members: number; tasks: number }
}

export interface ProjectMember {
  userId: string
  projectId: string
  role: ProjectRole
  user: User
  joinedAt: string
}

export interface Label {
  id: string
  name: string
  color: string
  projectId: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  position: number
  dueDate?: string
  projectId: string
  assignees: User[]
  labels: Label[]
  _count?: { comments: number; subtasks: number }
  parentId?: string | null
  movedAt?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface Comment {
  id: string
  body: string
  taskId: string
  authorId: string
  author: User
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  id: string
  taskId: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
  uploadedBy: Pick<User, 'id' | 'displayName'>
}

export interface Paginated<T> {
  items: T[]
  nextCursor?: string
}

export interface ProjectStats {
  byStatus: Partial<Record<TaskStatus, number>>
  byPriority: Partial<Record<TaskPriority, number>>
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface GlobalTask extends Task {
  project: { id: string; name: string; color: string | null }
}

export interface TaskFilters {
  status?: TaskStatus
  priority?: TaskPriority
  assigneeId?: string
  labelId?: string
  search?: string
}
