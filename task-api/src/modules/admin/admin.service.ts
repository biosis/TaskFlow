import type { PrismaClient, Prisma } from '@prisma/client';
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
