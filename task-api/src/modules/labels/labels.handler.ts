import type { FastifyRequest, FastifyReply } from 'fastify';
import * as labelsService from './labels.service.js';
import type { CreateLabelBody, UpdateLabelBody } from './labels.schema.js';

export async function createLabelHandler(
  request: FastifyRequest<{ Params: { pid: string }; Body: CreateLabelBody }>,
  reply: FastifyReply,
) {
  const label = await labelsService.createLabel(request.server.prisma, request.params.pid, request.body);
  return reply.status(201).send({ label });
}

export async function listLabelsHandler(
  request: FastifyRequest<{ Params: { pid: string } }>,
  reply: FastifyReply,
) {
  const labels = await labelsService.listLabels(request.server.prisma, request.params.pid);
  return reply.send({ labels });
}

export async function updateLabelHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLabelBody }>,
  reply: FastifyReply,
) {
  const label = await labelsService.updateLabel(request.server.prisma, request.params.id, request.body);
  return reply.send({ label });
}

export async function deleteLabelHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await labelsService.deleteLabel(request.server.prisma, request.params.id);
  return reply.status(204).send();
}

export async function addTaskLabelHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { labelId: string } }>,
  reply: FastifyReply,
) {
  await labelsService.addTaskLabel(request.server.prisma, request.params.id, request.body.labelId);
  return reply.status(201).send();
}

export async function removeTaskLabelHandler(
  request: FastifyRequest<{ Params: { id: string; labelId: string } }>,
  reply: FastifyReply,
) {
  await labelsService.removeTaskLabel(request.server.prisma, request.params.id, request.params.labelId);
  return reply.status(204).send();
}
