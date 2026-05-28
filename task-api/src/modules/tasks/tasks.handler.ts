import type { FastifyRequest, FastifyReply } from 'fastify';
import * as tasksService from './tasks.service.js';
import * as assigneesService from './tasks.assignees.service.js';
import * as depsService from './tasks.dependencies.service.js';
import * as searchService from './tasks.search.service.js';
import type { CreateTaskBody, UpdateTaskBody, ListTasksQuery, SearchQuery, ListGlobalTasksQuery } from './tasks.schema.js';
import { paginationQuerySchema } from '../../utils/pagination.js';
import type { ActivityEmitter } from '../activity/activity.emitter.js';

function getEmitter(request: FastifyRequest): ActivityEmitter | undefined {
  return (request as FastifyRequest & { activityEmitter?: ActivityEmitter }).activityEmitter;
}

export async function createTaskHandler(
  request: FastifyRequest<{ Params: { pid: string }; Body: CreateTaskBody }>,
  reply: FastifyReply,
) {
  const task = await tasksService.createTask(
    request.server.prisma,
    request.params.pid,
    request.user!.id,
    request.body,
  );
  getEmitter(request)?.enqueue({
    projectId: request.params.pid,
    taskId: task.id,
    actorId: request.user!.id,
    action: 'TASK_CREATED',
  });
  return reply.status(201).send({ task });
}

export async function listTasksHandler(
  request: FastifyRequest<{ Params: { pid: string }; Querystring: ListTasksQuery }>,
  reply: FastifyReply,
) {
  const result = await tasksService.listTasks(request.server.prisma, request.params.pid, request.query);
  return reply.send(result);
}

export async function listGlobalTasksHandler(
  request: FastifyRequest<{ Querystring: ListGlobalTasksQuery }>,
  reply: FastifyReply,
) {
  const result = await tasksService.listGlobalTasks(request.server.prisma, request.user!.id, request.query);
  return reply.send(result);
}

export async function searchTasksHandler(
  request: FastifyRequest<{ Params: { pid: string }; Querystring: SearchQuery }>,
  reply: FastifyReply,
) {
  const items = await searchService.searchTasks(
    request.server.prisma,
    request.params.pid,
    request.query.q,
    request.query.limit,
  );
  return reply.send({ items });
}

export async function getTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const task = await tasksService.getTask(request.server.prisma, request.params.id);
  return reply.send({ task });
}

export async function updateTaskHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateTaskBody }>,
  reply: FastifyReply,
) {
  const task = await tasksService.updateTask(request.server.prisma, request.params.id, request.body);
  if (request.body.status) {
    getEmitter(request)?.enqueue({
      projectId: task.projectId,
      taskId: task.id,
      actorId: request.user!.id,
      action: 'TASK_STATUS_CHANGED',
      metadata: { status: request.body.status },
    });
  }
  return reply.send({ task });
}

export async function deleteTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await tasksService.deleteTask(request.server.prisma, request.params.id);
  return reply.status(204).send();
}

export async function restoreTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const task = await tasksService.restoreTask(request.server.prisma, request.params.id);
  return reply.send({ task });
}

export async function listSubtasksHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { cursor?: string; limit?: number } }>,
  reply: FastifyReply,
) {
  const query = paginationQuerySchema.parse(request.query);
  const result = await tasksService.listSubtasks(request.server.prisma, request.params.id, query);
  return reply.send(result);
}

export async function addAssigneeHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { userId: string } }>,
  reply: FastifyReply,
) {
  const assignee = await assigneesService.addAssignee(
    request.server.prisma,
    request.params.id,
    request.body.userId,
    request.user!.id,
  );
  return reply.status(201).send({ assignee });
}

export async function removeAssigneeHandler(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply,
) {
  await assigneesService.removeAssignee(
    request.server.prisma,
    request.params.id,
    request.params.userId,
  );
  return reply.status(204).send();
}

export async function addDependencyHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { dependsOnTaskId: string } }>,
  reply: FastifyReply,
) {
  await depsService.addDependency(
    request.server.prisma,
    request.params.id,
    request.body.dependsOnTaskId,
    request.user!.id,
  );
  return reply.status(201).send();
}

export async function removeDependencyHandler(
  request: FastifyRequest<{ Params: { id: string; dependsOnTaskId: string } }>,
  reply: FastifyReply,
) {
  await depsService.removeDependency(
    request.server.prisma,
    request.params.id,
    request.params.dependsOnTaskId,
  );
  return reply.status(204).send();
}

export async function listDependenciesHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await depsService.listDependencies(request.server.prisma, request.params.id);
  return reply.send(result);
}

export async function moveTaskHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { projectId: string } }>,
  reply: FastifyReply,
) {
  const task = await tasksService.moveTask(request.server.prisma, request.params.id, request.body.projectId);
  return reply.send({ task });
}

export async function archiveTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const task = await tasksService.archiveTask(request.server.prisma, request.params.id, request.user!.id);
  getEmitter(request)?.enqueue({
    projectId: task.projectId,
    taskId: task.id,
    actorId: request.user!.id,
    action: 'TASK_ARCHIVED',
  });
  return reply.send({ task });
}

export async function unarchiveTaskHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const task = await tasksService.unarchiveTask(request.server.prisma, request.params.id);
  getEmitter(request)?.enqueue({
    projectId: task.projectId,
    taskId: task.id,
    actorId: request.user!.id,
    action: 'TASK_UNARCHIVED',
  });
  return reply.send({ task });
}

export async function archiveOldTasksHandler(
  request: FastifyRequest<{ Params: { pid: string } }>,
  reply: FastifyReply,
) {
  const result = await tasksService.archiveOldTasks(request.server.prisma, request.params.pid, request.user!.id, {});
  return reply.send(result);
}
