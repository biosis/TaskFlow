import type { FastifyRequest, FastifyReply } from 'fastify';
import * as usersService from './users.service.js';
import type { UpdateMeBody, ChangePasswordBody, DeleteMeBody } from './users.schema.js';

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = await usersService.getMe(request.server.prisma, request.user!.id);
  return reply.send({ user });
}

export async function updateMeHandler(
  request: FastifyRequest<{ Body: UpdateMeBody }>,
  reply: FastifyReply,
) {
  const user = await usersService.updateMe(request.server.prisma, request.user!.id, request.body);
  return reply.send({ user });
}

export async function changePasswordHandler(
  request: FastifyRequest<{ Body: ChangePasswordBody }>,
  reply: FastifyReply,
) {
  await usersService.changePassword(
    request.server.prisma,
    request.server.redis,
    request.user!.id,
    request.body,
  );
  return reply.status(204).send();
}

export async function deleteMeHandler(
  request: FastifyRequest<{ Body: DeleteMeBody }>,
  reply: FastifyReply,
) {
  await usersService.deleteMe(
    request.server.prisma,
    request.server.redis,
    request.user!.id,
    request.body.password,
  );
  return reply.status(204).send();
}
