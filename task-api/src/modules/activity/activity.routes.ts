import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { activityListQuery } from './activity.schema.js';
import {
  listProjectActivityHandler,
  listTaskActivityHandler,
  listUserActivityHandler,
} from './activity.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from '../projects/projects.members.service.js';
import { TaskNotFoundError } from '../../utils/errors.js';

export async function projectActivityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    preHandler: [
      async (req: FastifyRequest, _reply: FastifyReply) => {
        await assertProjectAccess({
          prisma: req.server.prisma,
          userId: req.user!.id,
          projectId: (req.params as { pid: string }).pid,
          requiredRole: 'MEMBER',
        });
      },
    ],
    schema: { querystring: activityListQuery },
    handler: listProjectActivityHandler,
  });
}

export async function taskActivityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    preHandler: [
      async (req: FastifyRequest, _reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const task = await req.server.prisma.task.findUnique({ where: { id }, select: { projectId: true } });
        if (!task) throw new TaskNotFoundError();
        await assertProjectAccess({
          prisma: req.server.prisma,
          userId: req.user!.id,
          projectId: task.projectId,
          requiredRole: 'MEMBER',
        });
      },
    ],
    schema: { querystring: activityListQuery },
    handler: listTaskActivityHandler,
  });
}

export async function userActivityRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.get('/', { schema: { querystring: activityListQuery }, handler: listUserActivityHandler });
}
