import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { config } from '../config.js';

export default fp(async (fastify) => {
  const redis = new Redis(config.REDIS_URL);
  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});
