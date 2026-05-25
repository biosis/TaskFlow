import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../config.js';

const errorResponseBuilder = (_request: FastifyRequest, context: { after: string }) => ({
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    details: [{ retryAfter: context.after }],
  },
});

export async function registerGlobalRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_USER_PER_MIN,
    timeWindow: '1 minute',
    redis: fastify.redis,
    keyGenerator: (request: FastifyRequest) => {
      const user = request.user as { id: string } | undefined;
      return user?.id ?? request.ip;
    },
    errorResponseBuilder,
  });
}

export async function registerAuthRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    max: config.RATE_LIMIT_AUTH_PER_MIN,
    timeWindow: '1 minute',
    redis: fastify.redis,
    keyGenerator: (request: FastifyRequest) => `auth:${request.ip}`,
    errorResponseBuilder,
  });
}
