import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTaskBody, updateTaskBody, listTasksQuery, searchQuery, listGlobalTasksQuery } from './tasks.schema.js';
import {
  createTaskHandler,
  listTasksHandler,
  listGlobalTasksHandler,
  searchTasksHandler,
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  restoreTaskHandler,
  listSubtasksHandler,
  addAssigneeHandler,
  removeAssigneeHandler,
  addDependencyHandler,
  removeDependencyHandler,
  listDependenciesHandler,
  moveTaskHandler,
  archiveTaskHandler,
  unarchiveTaskHandler,
  archiveOldTasksHandler,
} from './tasks.handler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { assertProjectAccess } from '../projects/projects.members.service.js';
import { TaskNotFoundError } from '../../utils/errors.js';
import { z } from 'zod';

async function resolveTaskProjectId(req: FastifyRequest): Promise<string> {
  const { id } = req.params as { id: string };
  const task = await req.server.prisma.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) throw new TaskNotFoundError();
  return task.projectId;
}

async function resolveDeletedTaskProjectId(req: FastifyRequest): Promise<string> {
  const { id } = req.params as { id: string };
  // Bypass soft-delete extension by using explicit deletedAt filter
  const task = await req.server.prisma.task.findFirst({
    where: { id, deletedAt: { not: null } },
    select: { projectId: true },
  });
  if (!task) throw new TaskNotFoundError();
  return task.projectId;
}

function assertProjectMember() {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const { pid } = req.params as { pid: string };
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId: pid,
      requiredRole: 'MEMBER',
    });
  };
}

function assertTaskMember() {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const projectId = await resolveTaskProjectId(req);
    await assertProjectAccess({
      prisma: req.server.prisma,
      userId: req.user!.id,
      projectId,
      requiredRole: 'MEMBER',
    });
  };
}

export async function projectTaskRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    preHandler: [assertProjectMember()],
    schema: { body: createTaskBody },
    handler: createTaskHandler,
  });

  fastify.get('/', {
    preHandler: [assertProjectMember()],
    schema: { querystring: listTasksQuery },
    handler: listTasksHandler,
  });

  fastify.get('/search', {
    preHandler: [assertProjectMember()],
    schema: { querystring: searchQuery },
    handler: searchTasksHandler,
  });

  fastify.post('/archive-old', {
    preHandler: [assertProjectMember()],
    handler: archiveOldTasksHandler,
  });
}

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/global', {
    schema: { querystring: listGlobalTasksQuery },
    handler: listGlobalTasksHandler,
  });

  fastify.get('/:id', { preHandler: [assertTaskMember()], handler: getTaskHandler });
  fastify.patch('/:id', { preHandler: [assertTaskMember()], schema: { body: updateTaskBody }, handler: updateTaskHandler });
  fastify.delete('/:id', { preHandler: [assertTaskMember()], handler: deleteTaskHandler });
  fastify.post('/:id/restore', {
    preHandler: [
      async (req: FastifyRequest, _reply: FastifyReply) => {
        const projectId = await resolveDeletedTaskProjectId(req);
        await assertProjectAccess({
          prisma: req.server.prisma,
          userId: req.user!.id,
          projectId,
          requiredRole: 'MEMBER',
        });
      },
    ],
    handler: restoreTaskHandler,
  });
  fastify.get('/:id/subtasks', { preHandler: [assertTaskMember()], handler: listSubtasksHandler });

  fastify.post('/:id/assignees', {
    preHandler: [assertTaskMember()],
    schema: { body: z.object({ userId: z.string().uuid() }) },
    handler: addAssigneeHandler,
  });
  fastify.delete('/:id/assignees/:userId', { preHandler: [assertTaskMember()], handler: removeAssigneeHandler });

  fastify.post('/:id/dependencies', {
    preHandler: [assertTaskMember()],
    schema: { body: z.object({ dependsOnTaskId: z.string().uuid() }) },
    handler: addDependencyHandler,
  });
  fastify.delete('/:id/dependencies/:dependsOnTaskId', { preHandler: [assertTaskMember()], handler: removeDependencyHandler });
  fastify.get('/:id/dependencies', { preHandler: [assertTaskMember()], handler: listDependenciesHandler });

  fastify.post('/:id/archive', { preHandler: [assertTaskMember()], handler: archiveTaskHandler });
  fastify.post('/:id/unarchive', { preHandler: [assertTaskMember()], handler: unarchiveTaskHandler });

  fastify.patch('/:id/move', {
    preHandler: [
      assertTaskMember(),
      async (req: FastifyRequest, _reply: FastifyReply) => {
        const { projectId } = req.body as { projectId: string };
        await assertProjectAccess({
          prisma: req.server.prisma,
          userId: req.user!.id,
          projectId,
          requiredRole: 'MEMBER',
        });
      },
    ],
    schema: { body: z.object({ projectId: z.string().uuid() }) },
    handler: moveTaskHandler,
  });
}
