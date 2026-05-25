import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { verify, hash, validateStrength } from '../../utils/password.js';
import { InvalidCredentialsError } from '../../utils/errors.js';
import type { UpdateMeBody, ChangePasswordBody } from './users.schema.js';

const USER_SELECT = {
  id: true, email: true, displayName: true, avatarUrl: true, archiveThresholdDays: true, emailVerified: true, createdAt: true,
} as const;

export async function getMe(prisma: PrismaClient, userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
}

export async function updateMe(prisma: PrismaClient, userId: string, data: UpdateMeBody) {
  return prisma.user.update({ where: { id: userId }, data, select: USER_SELECT });
}

export async function changePassword(
  prisma: PrismaClient,
  redis: Redis,
  userId: string,
  data: ChangePasswordBody,
) {
  validateStrength(data.newPassword);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verify(data.currentPassword, user.passwordHash))) throw new InvalidCredentialsError();

  const passwordHash = await hash(data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllSessions(prisma, redis, userId);
}

export async function deleteMe(
  prisma: PrismaClient,
  redis: Redis,
  userId: string,
  password: string,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verify(password, user.passwordHash))) throw new InvalidCredentialsError();

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await revokeAllSessions(prisma, redis, userId);
}

async function revokeAllSessions(prisma: PrismaClient, redis: Redis, userId: string) {
  const sessions = await prisma.refreshSession.findMany({
    where: { userId, revokedAt: null },
  });
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  for (const s of sessions) {
    await redis.set(`denylist:${s.id}`, '1', 'EX', 60 * 60 * 24 * 14);
  }
}
