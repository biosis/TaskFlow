import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccess } from '../utils/tokens.js';
import { UnauthenticatedError } from '../utils/errors.js';

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthenticatedError();

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccess(token);
    request.user = { id: payload.sub, email: payload.email };
  } catch {
    throw new UnauthenticatedError();
  }
}
