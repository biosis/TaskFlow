import type { FastifyRequest, FastifyReply } from 'fastify';
import * as commentsService from './comments.service.js';
import type { CreateCommentBody, UpdateCommentBody } from './comments.schema.js';
import { paginationQuerySchema } from '../../utils/pagination.js';

export async function createCommentHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateCommentBody }>,
  reply: FastifyReply,
) {
  const comment = await commentsService.createComment(
    request.server.prisma,
    request.params.id,
    request.user!.id,
    request.body,
  );
  return reply.status(201).send({ comment });
}

export async function listCommentsHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const query = paginationQuerySchema.parse(request.query);
  const result = await commentsService.listComments(request.server.prisma, request.params.id, query);
  return reply.send(result);
}

export async function updateCommentHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateCommentBody }>,
  reply: FastifyReply,
) {
  const comment = await commentsService.updateComment(
    request.server.prisma,
    request.params.id,
    request.user!.id,
    request.body,
  );
  return reply.send({ comment });
}

export async function deleteCommentHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await commentsService.deleteComment(request.server.prisma, request.params.id, request.user!.id);
  return reply.status(204).send();
}
