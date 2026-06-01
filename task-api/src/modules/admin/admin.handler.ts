import type { FastifyRequest, FastifyReply } from 'fastify';
import * as adminService from './admin.service.js';
import type { ListUsersQuery, UserIdParam } from './admin.schema.js';

export async function getStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const stats = await adminService.getStats(request.server.prisma);
  return reply.send(stats);
}

export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply,
) {
  const result = await adminService.listUsers(request.server.prisma, request.query);
  return reply.send(result);
}

export async function getUserStatsHandler(
  request: FastifyRequest<{ Params: UserIdParam }>,
  reply: FastifyReply,
) {
  return reply.send(await adminService.getUserStats(request.server.prisma, request.params.userId));
}
