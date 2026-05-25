import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLabelBody, updateLabelBody } from './labels.schema.js';
import {
  createLabelHandler,
  listLabelsHandler,
  updateLabelHandler,
  deleteLabelHandler,
  addTaskLabelHandler,
  removeTaskLabelHandler,
} from './labels.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from '../projects/projects.members.service.js';
import { TaskNotFoundError, NotFoundError } from '../../utils/errors.js';
import { z } from 'zod';

export async function projectLabelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  const assertMember = async (req: FastifyRequest, _reply: FastifyReply) => {
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId: (req.params as { pid: string }).pid,
      requiredRole: 'MEMBER',
    });
  };

  fastify.post('/', { preHandler: [assertMember], schema: { body: createLabelBody }, handler: createLabelHandler });
  fastify.get('/', { preHandler: [assertMember], handler: listLabelsHandler });
}

export async function labelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  const assertLabelAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const label = await req.server.prisma.label.findUnique({ where: { id }, select: { projectId: true } });
    if (!label) throw new NotFoundError('Label');
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId: label.projectId,
      requiredRole: 'ADMIN',
    });
  };

  fastify.patch('/:id', { preHandler: [assertLabelAdmin], schema: { body: updateLabelBody }, handler: updateLabelHandler });
  fastify.delete('/:id', { preHandler: [assertLabelAdmin], handler: deleteLabelHandler });
}

export async function taskLabelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  const assertMember = async (req: FastifyRequest, _reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const task = await req.server.prisma.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!task) throw new TaskNotFoundError();
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId: task.projectId,
      requiredRole: 'MEMBER',
    });
  };

  fastify.post('/', {
    preHandler: [assertMember],
    schema: { body: z.object({ labelId: z.string().uuid() }) },
    handler: addTaskLabelHandler,
  });
  fastify.delete('/:labelId', { preHandler: [assertMember], handler: removeTaskLabelHandler });
}
