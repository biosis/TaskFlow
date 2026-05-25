import type { FastifyInstance } from 'fastify';
import { registerBody, loginBody } from './auth.schema.js';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
} from './auth.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { registerAuthRateLimit } from '../../middleware/rate-limit.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  await registerAuthRateLimit(fastify);

  fastify.post('/register', {
    schema: { body: registerBody },
    handler: registerHandler,
  });

  fastify.post('/login', {
    schema: { body: loginBody },
    handler: loginHandler,
  });

  fastify.post('/refresh', { handler: refreshHandler });
  fastify.post('/logout', { handler: logoutHandler });

  fastify.get('/me', {
    preHandler: [authenticate],
    handler: getMeHandler,
  });
}
