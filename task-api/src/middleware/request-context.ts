import type { FastifyRequest, FastifyReply } from 'fastify';
import { newId } from '../utils/id.js';

export async function requestContext(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const requestId = newId();
  (request as FastifyRequest & { requestId: string }).requestId = requestId;
  void reply.header('x-request-id', requestId);
}
