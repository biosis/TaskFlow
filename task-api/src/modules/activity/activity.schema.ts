import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const activityListQuery = paginationQuerySchema.extend({
  action: z.string().optional(),
});

export type ActivityListQuery = z.infer<typeof activityListQuery>;
