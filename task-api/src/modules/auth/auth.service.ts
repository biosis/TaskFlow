import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { newId } from '../../utils/id.js';
import { hash, verify, validateStrength } from '../../utils/password.js';
import { signAccess, signRefresh, verifyRefresh } from '../../utils/tokens.js';
import {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidRefreshError,
  RefreshRevokedError,
} from '../../utils/errors.js';
import { config } from '../../config.js';

function denylistKey(jti: string) {
  return `denylist:${jti}`;
}

export async function register(
  prisma: PrismaClient,
  redis: Redis,
  data: { email: string; password: string; displayName: string },
  meta: { userAgent?: string; ip?: string },
) {
  validateStrength(data.password);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new EmailTakenError();

  const passwordHash = await hash(data.password);
  const userId = newId();

  const user = await prisma.user.create({
    data: { id: userId, email: data.email, passwordHash, displayName: data.displayName },
  });

  return issueTokens(prisma, redis, user, meta);
}

// Pre-computed cost-12 hash of a dummy password to prevent user-enumeration
// via timing differences when the email is not found (constant-time path).
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8k2J1Q5lI4uM6WlZJ4wGnK0O1kHkqG';

export async function login(
  prisma: PrismaClient,
  redis: Redis,
  data: { email: string; password: string },
  meta: { userAgent?: string; ip?: string },
) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const stored = user?.passwordHash ?? DUMMY_HASH;
  const ok = await verify(data.password, stored);
  if (!user || !ok) throw new InvalidCredentialsError();

  return issueTokens(prisma, redis, user, meta);
}

export async function refresh(
  prisma: PrismaClient,
  redis: Redis,
  refreshToken: string,
  meta: { userAgent?: string; ip?: string },
) {
  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw new InvalidRefreshError();
  }

  const isDenylisted = await redis.exists(denylistKey(payload.jti));
  if (isDenylisted) throw new RefreshRevokedError();

  const session = await prisma.refreshSession.findUnique({ where: { id: payload.jti } });
  if (!session || session.revokedAt) throw new InvalidRefreshError();

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new InvalidRefreshError();

  await prisma.refreshSession.update({
    where: { id: payload.jti },
    data: { revokedAt: new Date() },
  });
  await redis.set(denylistKey(payload.jti), '1', 'EX', config.JWT_REFRESH_TTL);

  return issueTokens(prisma, redis, user, meta);
}

export async function logout(prisma: PrismaClient, redis: Redis, refreshToken: string) {
  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    return; // idempotent
  }

  const isDenylisted = await redis.exists(denylistKey(payload.jti));
  if (isDenylisted) return;

  await prisma.refreshSession.updateMany({
    where: { id: payload.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.set(denylistKey(payload.jti), '1', 'EX', config.JWT_REFRESH_TTL);
}

async function issueTokens(
  prisma: PrismaClient,
  redis: Redis,
  user: { id: string; email: string },
  meta: { userAgent?: string; ip?: string },
) {
  const jti = newId();
  const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL * 1000);

  await prisma.refreshSession.create({
    data: {
      id: jti,
      userId: user.id,
      expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  const accessToken = signAccess({ sub: user.id, email: user.email });
  const refreshToken = signRefresh({ sub: user.id, jti });

  return { accessToken, refreshToken, jti };
}
