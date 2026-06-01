import { z } from 'zod';

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'deleted']).default('active'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;

export const userIdParam = z.object({ userId: z.string().uuid() });
export type UserIdParam = z.infer<typeof userIdParam>;
