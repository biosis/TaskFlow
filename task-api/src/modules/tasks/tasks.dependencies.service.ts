import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  SelfDependencyError,
  DependencyCycleError,
  DependencyExistsError,
  TaskNotFoundError,
  NotFoundError,
} from '../../utils/errors.js';

export async function addDependency(
  prisma: PrismaClient,
  fromTaskId: string,
  toTaskId: string,
  createdBy: string,
) {
  if (fromTaskId === toTaskId) throw new SelfDependencyError();

  const [fromTask, toTask] = await Promise.all([
    prisma.task.findUnique({ where: { id: fromTaskId, deletedAt: null } }),
    prisma.task.findUnique({ where: { id: toTaskId, deletedAt: null } }),
  ]);
  if (!fromTask) throw new TaskNotFoundError();
  if (!toTask) throw new NotFoundError('Dependency target task');

  if (fromTask.projectId !== toTask.projectId) throw new TaskNotFoundError();

  const existing = await prisma.taskDependency.findUnique({
    where: { fromTaskId_toTaskId: { fromTaskId, toTaskId } },
  });
  if (existing) throw new DependencyExistsError();

  await prisma.$transaction(
    async (tx) => {
      const cycleCheck = await tx.$queryRaw<{ found: boolean }[]>(
        Prisma.sql`
          WITH RECURSIVE deps AS (
            SELECT from_task_id, to_task_id, 1 AS depth
            FROM task_dependencies WHERE from_task_id = ${toTaskId}::uuid
            UNION ALL
            SELECT td.from_task_id, td.to_task_id, d.depth + 1
            FROM task_dependencies td JOIN deps d ON td.from_task_id = d.to_task_id
            WHERE d.depth < 1000
          )
          SELECT EXISTS(SELECT 1 FROM deps WHERE to_task_id = ${fromTaskId}::uuid) AS found
        `,
      );

      if (cycleCheck[0]?.found) throw new DependencyCycleError();

      await tx.taskDependency.create({ data: { fromTaskId, toTaskId, createdBy } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function removeDependency(
  prisma: PrismaClient,
  fromTaskId: string,
  toTaskId: string,
) {
  const existing = await prisma.taskDependency.findUnique({
    where: { fromTaskId_toTaskId: { fromTaskId, toTaskId } },
  });
  if (!existing) throw new NotFoundError('Dependency');

  await prisma.taskDependency.delete({
    where: { fromTaskId_toTaskId: { fromTaskId, toTaskId } },
  });
}

export async function listDependencies(prisma: PrismaClient, taskId: string) {
  const [dependencies, dependents] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { fromTaskId: taskId },
      include: { toTask: { select: { id: true, title: true, status: true, projectId: true } } },
    }),
    prisma.taskDependency.findMany({
      where: { toTaskId: taskId },
      include: { fromTask: { select: { id: true, title: true, status: true, projectId: true } } },
    }),
  ]);
  return { dependencies, dependents };
}
