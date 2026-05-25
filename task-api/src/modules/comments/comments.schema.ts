import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const createCommentBody = z.object({ body: z.string().min(1) });
export const updateCommentBody = z.object({ body: z.string().min(1) });
export const listCommentsQuery = paginationQuerySchema;

export type CreateCommentBody = z.infer<typeof createCommentBody>;
export type UpdateCommentBody = z.infer<typeof updateCommentBody>;
