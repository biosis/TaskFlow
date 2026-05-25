import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ProjectRole } from '@prisma/client';
import { assertProjectAccess } from '../modules/projects/projects.members.service.js';

export function requireRole(role: ProjectRole) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const params = request.params as Record<string, string>;
    const resolvedProjectId = params['projectId'] ?? params['pid'];
    const user = request.user as { id: string } | undefined;
    if (!resolvedProjectId || !user) return;

    await assertProjectAccess({
      prisma: request.server.prisma,
      userId: user.id,
      projectId: resolvedProjectId,
      requiredRole: role,
    });
  };
}
