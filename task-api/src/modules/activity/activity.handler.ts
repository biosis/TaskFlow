import type { FastifyRequest, FastifyReply } from 'fastify';
import * as activityService from './activity.service.js';
import type { ActivityListQuery } from './activity.schema.js';

export async function listProjectActivityHandler(
  request: FastifyRequest<{ Params: { pid: string }; Querystring: ActivityListQuery }>,
  reply: FastifyReply,
) {
  const result = await activityService.listProjectActivity(
    request.server.prisma,
    request.params.pid,
    request.query,
  );
  return reply.send(result);
}

export async function listTaskActivityHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: ActivityListQuery }>,
  reply: FastifyReply,
) {
  const result = await activityService.listTaskActivity(
    request.server.prisma,
    request.params.id,
    request.query,
  );
  return reply.send(result);
}

export async function listUserActivityHandler(
  request: FastifyRequest<{ Querystring: ActivityListQuery }>,
  reply: FastifyReply,
) {
  const result = await activityService.listUserActivity(
    request.server.prisma,
    request.user!.id,
    request.query,
  );
  return reply.send(result);
}
