import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const createTaskBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.union([z.string().date(), z.string().datetime()]).optional(),
  parentId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).max(10).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskBody = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.union([z.string().date(), z.string().datetime()]).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const listTasksQuery = paginationQuerySchema.extend({
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  sort: z.enum(['position', 'createdAt', 'movedAt', 'dueDate', 'priority']).default('position'),
  archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
});

export const archiveTasksQuery = z.object({});

export const searchQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const listGlobalTasksQuery = z.object({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(250).default(250),
});

export type CreateTaskBody = z.infer<typeof createTaskBody>;
export type UpdateTaskBody = z.infer<typeof updateTaskBody>;
export type ListTasksQuery = z.infer<typeof listTasksQuery>;
export type ArchiveTasksQuery = z.infer<typeof archiveTasksQuery>;
export type SearchQuery = z.infer<typeof searchQuery>;
export type ListGlobalTasksQuery = z.infer<typeof listGlobalTasksQuery>;
