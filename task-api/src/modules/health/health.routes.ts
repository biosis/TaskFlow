import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/healthz', { config: { rateLimit: false } }, async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });

  fastify.get('/readyz', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      await fastify.redis.ping();
      return reply.send({ status: 'ok' });
    } catch {
      return reply.status(503).send({ status: 'error' });
    }
  });
}
