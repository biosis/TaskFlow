import type { PrismaClient } from '@prisma/client';
import { decodeCursor, encodeCursor, DEFAULT_LIMIT } from '../../utils/pagination.js';
import type { ActivityListQuery } from './activity.schema.js';

export async function listProjectActivity(
  prisma: PrismaClient,
  projectId: string,
  query: ActivityListQuery,
) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.activity.findMany({
    where: {
      projectId,
      ...(cursor
        ? { OR: [{ createdAt: { lt: new Date(cursor.v) } }, { createdAt: new Date(cursor.v), id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { actor: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  return { items, nextCursor };
}

export async function listTaskActivity(
  prisma: PrismaClient,
  taskId: string,
  query: ActivityListQuery,
) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.activity.findMany({
    where: {
      taskId,
      ...(cursor
        ? { OR: [{ createdAt: { lt: new Date(cursor.v) } }, { createdAt: new Date(cursor.v), id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { actor: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  return { items, nextCursor };
}

export async function listUserActivity(
  prisma: PrismaClient,
  userId: string,
  query: ActivityListQuery,
) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.activity.findMany({
    where: {
      actorId: userId,
      ...(cursor
        ? { OR: [{ createdAt: { lt: new Date(cursor.v) } }, { createdAt: new Date(cursor.v), id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  return { items, nextCursor };
}
