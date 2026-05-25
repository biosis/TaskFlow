import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../config.js';
import type { AuthedUser } from './context.js';

// Override @fastify/jwt user type so request.user is AuthedUser
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthedUser;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    config: AppConfig;
  }
}
