import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createProjectBody,
  updateProjectBody,
  addMemberBody,
  updateMemberBody,
  listProjectsQuery,
} from './projects.schema.js';
import {
  createProjectHandler,
  listProjectsHandler,
  getProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  restoreProjectHandler,
  archiveProjectHandler,
  unarchiveProjectHandler,
  listMembersHandler,
  addMemberHandler,
  updateMemberHandler,
  removeMemberHandler,
  getProjectStatsHandler,
} from './projects.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from './projects.members.service.js';
import { ProjectNotFoundError } from '../../utils/errors.js';

function getIdParam(req: FastifyRequest) {
  return (req.params as { id: string }).id;
}

function assertRole(role: Parameters<typeof assertProjectAccess>[0]['requiredRole']) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId: getIdParam(req),
      requiredRole: role,
    });
  };
}

export async function projectsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', { schema: { body: createProjectBody }, handler: createProjectHandler });
  fastify.get('/', { schema: { querystring: listProjectsQuery }, handler: listProjectsHandler });

  fastify.get('/:id', { preHandler: [assertRole('MEMBER')], handler: getProjectHandler });
  fastify.patch('/:id', { preHandler: [assertRole('ADMIN')], schema: { body: updateProjectBody }, handler: updateProjectHandler });
  fastify.delete('/:id', { preHandler: [assertRole('OWNER')], handler: deleteProjectHandler });

  fastify.post('/:id/restore', {
    preHandler: [
      async (req: FastifyRequest, _reply: FastifyReply) => {
        const id = getIdParam(req);
        const m = await req.server.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId: req.user!.id } },
        });
        if (!m || m.role !== 'OWNER') throw new ProjectNotFoundError();
      },
    ],
    handler: restoreProjectHandler,
  });

  fastify.post('/:id/archive', { preHandler: [assertRole('ADMIN')], handler: archiveProjectHandler });

  fastify.post('/:id/unarchive', {
    preHandler: [
      async (req: FastifyRequest, _reply: FastifyReply) => {
        const id = getIdParam(req);
        const m = await req.server.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId: req.user!.id } },
        });
        const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
        if (!m || (ROLE_RANK[m.role] ?? 0) < ROLE_RANK['ADMIN']!) throw new ProjectNotFoundError();
      },
    ],
    handler: unarchiveProjectHandler,
  });

  fastify.get('/:id/stats', { preHandler: [assertRole('MEMBER')], handler: getProjectStatsHandler });
  fastify.get('/:id/members', { preHandler: [assertRole('MEMBER')], handler: listMembersHandler });
  fastify.post('/:id/members', { preHandler: [assertRole('ADMIN')], schema: { body: addMemberBody }, handler: addMemberHandler });
  fastify.patch('/:id/members/:userId', { preHandler: [assertRole('ADMIN')], schema: { body: updateMemberBody }, handler: updateMemberHandler });
  fastify.delete('/:id/members/:userId', { preHandler: [assertRole('ADMIN')], handler: removeMemberHandler });
}
