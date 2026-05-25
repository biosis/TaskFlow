import type { FastifyInstance } from 'fastify';
import { updateMeBody, changePasswordBody, deleteMeBody } from './users.schema.js';
import {
  getMeHandler,
  updateMeHandler,
  changePasswordHandler,
  deleteMeHandler,
} from './users.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/me', { handler: getMeHandler });
  fastify.patch('/me', { schema: { body: updateMeBody }, handler: updateMeHandler });
  fastify.post('/me/password', { schema: { body: changePasswordBody }, handler: changePasswordHandler });
  fastify.delete('/me', { schema: { body: deleteMeBody }, handler: deleteMeHandler });
}
