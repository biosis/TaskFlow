import type { PrismaClient } from '@prisma/client';
import { MaxAssigneesExceededError, NotFoundError, TaskNotFoundError, ForbiddenError } from '../../utils/errors.js';
import { config } from '../../config.js';

export async function addAssignee(
  prisma: PrismaClient,
  taskId: string,
  userId: string,
  assignedBy: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new TaskNotFoundError();

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const membership = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } },
    });
    if (!membership) throw new ForbiddenError();

    const count = await tx.taskAssignee.count({ where: { taskId } });
    if (count >= config.MAX_ASSIGNEES_PER_TASK) throw new MaxAssigneesExceededError();

    return tx.taskAssignee.create({
      data: { taskId, userId, assignedBy },
      include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
    });
  });
}

export async function removeAssignee(prisma: PrismaClient, taskId: string, userId: string) {
  const existing = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (!existing) throw new NotFoundError('Assignee');

  await prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } });
}
