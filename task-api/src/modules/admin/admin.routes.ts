import type { FastifyInstance } from 'fastify';
import { listUsersQuery, userIdParam } from './admin.schema.js';
import { getStatsHandler, listUsersHandler, getUserStatsHandler } from './admin.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/stats', { handler: getStatsHandler });
  fastify.get('/users', { schema: { querystring: listUsersQuery }, handler: listUsersHandler });
  fastify.get('/users/:userId/stats', { schema: { params: userIdParam }, handler: getUserStatsHandler });
}
