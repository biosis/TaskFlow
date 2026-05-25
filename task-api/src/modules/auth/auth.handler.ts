import type { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './auth.service.js';
import type { RegisterBody, LoginBody } from './auth.schema.js';
import { config } from '../../config.js';

const COOKIE_NAME = 'rt';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  secure: config.COOKIE_SECURE,
  domain: config.COOKIE_DOMAIN || undefined,
  maxAge: config.JWT_REFRESH_TTL,
};

export async function registerHandler(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply,
) {
  const meta = { userAgent: request.headers['user-agent'], ip: request.ip };
  const { accessToken, refreshToken } = await authService.register(
    request.server.prisma,
    request.server.redis,
    request.body,
    meta,
  );

  const user = await request.server.prisma.user.findUniqueOrThrow({
    where: { email: request.body.email },
    select: { id: true, email: true, displayName: true, avatarUrl: true, emailVerified: true, createdAt: true },
  });

  void reply.setCookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);
  return reply.status(201).send({ user, accessToken });
}

export async function loginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply,
) {
  const meta = { userAgent: request.headers['user-agent'], ip: request.ip };
  const { accessToken, refreshToken } = await authService.login(
    request.server.prisma,
    request.server.redis,
    request.body,
    meta,
  );

  const user = await request.server.prisma.user.findUniqueOrThrow({
    where: { email: request.body.email },
    select: { id: true, email: true, displayName: true, avatarUrl: true, emailVerified: true, createdAt: true },
  });

  void reply.setCookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);
  return reply.status(200).send({ user, accessToken });
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) {
    const { InvalidRefreshError } = await import('../../utils/errors.js');
    throw new InvalidRefreshError();
  }

  const meta = { userAgent: request.headers['user-agent'], ip: request.ip };
  const { accessToken, refreshToken } = await authService.refresh(
    request.server.prisma,
    request.server.redis,
    token,
    meta,
  );

  void reply.setCookie(COOKIE_NAME, refreshToken, COOKIE_OPTS);
  return reply.status(200).send({ accessToken });
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[COOKIE_NAME];
  if (token) {
    await authService.logout(request.server.prisma, request.server.redis, token);
  }

  void reply.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
  return reply.status(204).send();
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = await request.server.prisma.user.findUniqueOrThrow({
    where: { id: request.user!.id },
    select: { id: true, email: true, displayName: true, avatarUrl: true, emailVerified: true, createdAt: true },
  });
  return reply.send({ user });
}
