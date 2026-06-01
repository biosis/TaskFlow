import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../utils/errors.js';

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = await request.server.prisma.user.findUnique({
    where: { id: request.user.id },
    select: { role: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.role !== 'ADMIN') throw new ForbiddenError();
}
