import type { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '../../utils/errors.js';
import type { ListUsersQuery } from './admin.schema.js';

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  deletedAt: true,
  lastLoginAt: true,
} as const;

export async function getStats(prisma: PrismaClient) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    deletedUsers,
    adminUsers,
    newUsersLast30Days,
    totalProjects,
    activeProjects,
    archivedProjects,
    totalTasks,
    tasksByStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
    prisma.project.count(),
    prisma.project.count({ where: { deletedAt: null, archivedAt: null } }),
    prisma.project.count({ where: { deletedAt: null, archivedAt: { not: null } } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.task.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
  ]);

  const byStatus = Object.fromEntries(tasksByStatus.map((g) => [g.status, g._count]));

  return {
    users: { total: totalUsers, active: activeUsers, deleted: deletedUsers, admins: adminUsers },
    projects: { total: totalProjects, active: activeProjects, archived: archivedProjects },
    tasks: { total: totalTasks, byStatus },
    newUsersLast30Days,
  };
}

export async function getUserStats(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ADMIN_USER_SELECT });
  if (!user) throw new NotFoundError('User');

  const [
    tasksCreatedTotal,
    tasksCreatedByStatus,
    tasksAssignedTotal,
    tasksAssignedByStatus,
    projectsOwned,
    projectsMember,
    commentsCount,
    activitiesCount,
    lastActivity,
  ] = await Promise.all([
    prisma.task.count({ where: { createdById: userId, deletedAt: null } }),
    prisma.task.groupBy({ by: ['status'], where: { createdById: userId, deletedAt: null }, _count: true }),
    prisma.task.count({ where: { assignees: { some: { userId } }, deletedAt: null } }),
    prisma.task.groupBy({ by: ['status'], where: { assignees: { some: { userId } }, deletedAt: null }, _count: true }),
    prisma.project.count({ where: { ownerId: userId, deletedAt: null } }),
    prisma.projectMember.count({ where: { userId, project: { deletedAt: null } } }),
    prisma.comment.count({ where: { authorId: userId, deletedAt: null } }),
    prisma.activity.count({ where: { actorId: userId } }),
    prisma.activity.findFirst({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);

  return {
    user,
    tasksCreated: {
      total: tasksCreatedTotal,
      byStatus: Object.fromEntries(tasksCreatedByStatus.map((g) => [g.status, g._count])),
    },
    tasksAssigned: {
      total: tasksAssignedTotal,
      byStatus: Object.fromEntries(tasksAssignedByStatus.map((g) => [g.status, g._count])),
    },
    projects: { owned: projectsOwned, memberOf: projectsMember },
    commentsCount,
    activitiesCount,
    lastActivityAt: lastActivity?.createdAt ?? null,
  };
}

export async function listUsers(prisma: PrismaClient, params: ListUsersQuery) {
  const { page, limit, search, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (status === 'active') where.deletedAt = null;
  else if (status === 'deleted') where.deletedAt = { not: null };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: ADMIN_USER_SELECT, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page, limit };
}
