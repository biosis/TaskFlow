import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from '../projects/projects.members.service.js';
import { TaskNotFoundError } from '../../utils/errors.js';
import { config } from '../../config.js';
import {
  uploadAttachmentHandler,
  listAttachmentsHandler,
  downloadAttachmentHandler,
  deleteAttachmentHandler,
} from './attachments.handler.js';

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

export async function taskAttachmentRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fileSize: config.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });

  fastify.addHook('preHandler', authenticate);

  fastify.post('/', { preHandler: [assertTaskMember], handler: uploadAttachmentHandler });
  fastify.get('/', { preHandler: [assertTaskMember], handler: listAttachmentsHandler });
}

export async function attachmentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/:id/download', { handler: downloadAttachmentHandler });
  fastify.delete('/:id', { handler: deleteAttachmentHandler });
}
