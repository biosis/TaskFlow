import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const createProjectBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateProjectBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const addMemberBody = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const updateMemberBody = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const listProjectsQuery = paginationQuerySchema.extend({
  q: z.string().optional(),
  archived: z.coerce.boolean().optional(),
});

export type CreateProjectBody = z.infer<typeof createProjectBody>;
export type UpdateProjectBody = z.infer<typeof updateProjectBody>;
export type AddMemberBody = z.infer<typeof addMemberBody>;
export type UpdateMemberBody = z.infer<typeof updateMemberBody>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;
