import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createCommentBody, updateCommentBody } from './comments.schema.js';
import {
  createCommentHandler,
  listCommentsHandler,
  updateCommentHandler,
  deleteCommentHandler,
} from './comments.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from '../projects/projects.members.service.js';
import { TaskNotFoundError } from '../../utils/errors.js';

async function assertTaskMember(req: FastifyRequest, _reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const task = await req.server.prisma.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) throw new TaskNotFoundError();
  await assertProjectAccess({
    prisma: req.server.prisma,
    userId: req.user!.id,
    projectId: task.projectId,
    requiredRole: 'MEMBER',
  });
}

export async function taskCommentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.post('/', { preHandler: [assertTaskMember], schema: { body: createCommentBody }, handler: createCommentHandler });
  fastify.get('/', { preHandler: [assertTaskMember], handler: listCommentsHandler });
}

export async function commentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.patch('/:id', { schema: { body: updateCommentBody }, handler: updateCommentHandler });
  fastify.delete('/:id', { handler: deleteCommentHandler });
}
