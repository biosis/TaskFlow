import type { PrismaClient, ProjectRole } from '@prisma/client';
import { ProjectNotFoundError, ForbiddenError, NotFoundError, MemberAlreadyExistsError } from '../../utils/errors.js';

const ROLE_RANK: Record<ProjectRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export async function assertProjectAccess({
  prisma,
  userId,
  projectId,
  requiredRole,
}: {
  prisma: PrismaClient;
  userId: string;
  projectId: string;
  requiredRole: ProjectRole;
}): Promise<void> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: { select: { deletedAt: true, archivedAt: true } } },
  });

  if (!membership || membership.project.deletedAt || membership.project.archivedAt) throw new ProjectNotFoundError();
  if (ROLE_RANK[membership.role] < ROLE_RANK[requiredRole]) throw new ProjectNotFoundError();
}

export async function getMemberRole(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return membership?.role ?? null;
}

export async function listMembers(prisma: PrismaClient, projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
  });
}

export async function addMember(
  prisma: PrismaClient,
  projectId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER',
  _actorId: string,
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new NotFoundError('User');

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existing) throw new MemberAlreadyExistsError();

  return prisma.projectMember.create({
    data: { projectId, userId: user.id, role },
    include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
  });
}

export async function updateMember(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER',
) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new NotFoundError('Member');
  if (membership.role === 'OWNER') throw new ForbiddenError();

  return prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
  });
}

export async function removeMember(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new NotFoundError('Member');
  if (membership.role === 'OWNER') throw new ForbiddenError();

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}
