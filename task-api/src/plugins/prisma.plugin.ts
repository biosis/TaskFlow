import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '../utils/soft-delete.js';

export default fp(async (fastify) => {
  const prisma = new PrismaClient().$extends(softDeleteExtension) as unknown as PrismaClient;
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await (prisma as unknown as PrismaClient).$disconnect();
  });
});
