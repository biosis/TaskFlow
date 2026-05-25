import type { PrismaClient } from '@prisma/client';
import { newId } from '../../utils/id.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { decodeCursor, encodeCursor, DEFAULT_LIMIT } from '../../utils/pagination.js';
import { getMemberRole } from '../projects/projects.members.service.js';
import type { CreateCommentBody, UpdateCommentBody } from './comments.schema.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export async function createComment(
  prisma: PrismaClient,
  taskId: string,
  authorId: string,
  data: CreateCommentBody,
) {
  return prisma.comment.create({
    data: { id: newId(), taskId, authorId, body: data.body },
    include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
}

export async function listComments(
  prisma: PrismaClient,
  taskId: string,
  query: { cursor?: string; limit?: number },
) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.comment.findMany({
    where: {
      taskId,
      deletedAt: null,
      ...(cursor
        ? { OR: [{ createdAt: { gt: new Date(cursor.v) } }, { createdAt: new Date(cursor.v), id: { gt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  return { items, nextCursor };
}

export async function updateComment(
  prisma: PrismaClient,
  commentId: string,
  userId: string,
  data: UpdateCommentBody,
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    include: { task: { select: { projectId: true } } },
  });
  if (!comment) throw new NotFoundError('Comment');
  if (comment.authorId !== userId) throw new ForbiddenError();
  if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) throw new ForbiddenError();
  const role = await getMemberRole(prisma, userId, comment.task.projectId);
  if (!role) throw new ForbiddenError();

  return prisma.comment.update({
    where: { id: commentId },
    data: { body: data.body },
    include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
}

export async function deleteComment(
  prisma: PrismaClient,
  commentId: string,
  userId: string,
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    include: { task: { select: { projectId: true } } },
  });
  if (!comment) throw new NotFoundError('Comment');

  const isAuthor = comment.authorId === userId;
  const role = await getMemberRole(prisma, userId, comment.task.projectId);
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isAuthor && !isAdmin) throw new ForbiddenError();

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
}
