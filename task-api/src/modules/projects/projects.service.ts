import type { PrismaClient } from '@prisma/client';
import { newId } from '../../utils/id.js';
import { ProjectNotFoundError, ProjectNotEmptyError, RestoreWindowExpiredError } from '../../utils/errors.js';
import { decodeCursor, encodeCursor, DEFAULT_LIMIT } from '../../utils/pagination.js';
import { config } from '../../config.js';
import type { CreateProjectBody, UpdateProjectBody, ListProjectsQuery } from './projects.schema.js';

const PROJECT_SELECT = {
  id: true, name: true, description: true, color: true, ownerId: true,
  createdAt: true, updatedAt: true, archivedAt: true,
  _count: { select: { members: true, tasks: { where: { parentId: null, deletedAt: null } } } },
} as const;

export async function createProject(
  prisma: PrismaClient,
  ownerId: string,
  data: CreateProjectBody,
) {
  const id = newId();
  const project = await prisma.project.create({
    data: { id, ownerId, ...data },
    select: PROJECT_SELECT,
  });
  await prisma.projectMember.create({ data: { projectId: id, userId: ownerId, role: 'OWNER' } });
  return project;
}

export async function listProjects(
  prisma: PrismaClient,
  userId: string,
  query: ListProjectsQuery,
) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.project.findMany({
    where: {
      members: { some: { userId } },
      deletedAt: null,
      archivedAt: query.archived ? { not: null } : null,
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(cursor
        ? { OR: [{ createdAt: { lt: new Date(cursor.v) } }, { createdAt: new Date(cursor.v), id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: PROJECT_SELECT,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  return { items, nextCursor };
}

export async function getProject(prisma: PrismaClient, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
      },
    },
  });
  if (!project) throw new ProjectNotFoundError();
  return project;
}

export async function updateProject(
  prisma: PrismaClient,
  projectId: string,
  data: UpdateProjectBody,
) {
  return prisma.project.update({
    where: { id: projectId, deletedAt: null },
    data,
    select: PROJECT_SELECT,
  });
}

export async function deleteProject(prisma: PrismaClient, projectId: string) {
  const taskCount = await prisma.task.count({
    where: { projectId, deletedAt: null },
  });
  if (taskCount > 0) throw new ProjectNotEmptyError();

  await prisma.project.update({
    where: { id: projectId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function archiveProject(prisma: PrismaClient, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null, archivedAt: null },
  });
  if (!project) throw new ProjectNotFoundError();

  return prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
    select: PROJECT_SELECT,
  });
}

export async function unarchiveProject(prisma: PrismaClient, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null, archivedAt: { not: null } },
  });
  if (!project) throw new ProjectNotFoundError();

  return prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: null },
    select: PROJECT_SELECT,
  });
}

export async function getProjectStats(prisma: PrismaClient, projectId: string) {
  const [statusCounts, priorityCounts] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId, parentId: null, deletedAt: null },
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { projectId, parentId: null, deletedAt: null },
      _count: { id: true },
    }),
  ])

  return {
    byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, r._count.id])) as Record<string, number>,
    byPriority: Object.fromEntries(priorityCounts.map((r) => [r.priority, r._count.id])) as Record<string, number>,
  }
}

export async function restoreProject(prisma: PrismaClient, projectId: string) {
  // Bypass soft-delete extension by using explicit deletedAt filter
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: { not: null } },
  });
  if (!project) throw new ProjectNotFoundError();

  const retentionMs = config.SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - project.deletedAt!.getTime() > retentionMs) {
    throw new RestoreWindowExpiredError();
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: null },
    select: PROJECT_SELECT,
  });
}
