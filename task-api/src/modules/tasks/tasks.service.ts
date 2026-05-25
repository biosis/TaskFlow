import type { PrismaClient, TaskStatus } from '@prisma/client';
import { newId } from '../../utils/id.js';
import {
  TaskNotFoundError,
  ParentNotFoundError,
  SubtaskDepthExceededError,
  InvalidStatusTransitionError,
  RestoreWindowExpiredError,
  ForbiddenError,
  TaskNotArchivableError,
} from '../../utils/errors.js';
import { decodeCursor, encodeCursor, DEFAULT_LIMIT } from '../../utils/pagination.js';
import { config } from '../../config.js';
import type { CreateTaskBody, UpdateTaskBody, ListTasksQuery, ArchiveTasksQuery } from './tasks.schema.js';

const TASK_SELECT = {
  id: true, projectId: true, parentId: true, depth: true, title: true, description: true,
  status: true, priority: true, dueDate: true, position: true, createdById: true,
  createdAt: true, updatedAt: true, completedAt: true, movedAt: true, archivedAt: true,
  assignees: { include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } } },
  labels: { include: { label: true } },
} as const;

function flattenRelations<T extends {
  assignees: { user: { id: string; email: string; displayName: string; avatarUrl: string | null } }[];
  labels: { label: { id: string; name: string; color: string; projectId: string } }[];
}>(task: T) {
  return {
    ...task,
    assignees: task.assignees.map((a) => a.user),
    labels: task.labels.map((l) => l.label),
  };
}

const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'],
  REVIEW: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'],
  DONE: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'CANCELLED'],
  CANCELLED: ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE'],
};

export async function createTask(
  prisma: PrismaClient,
  projectId: string,
  createdById: string,
  data: CreateTaskBody,
) {
  let depth = 0;
  if (data.parentId) {
    const parent = await prisma.task.findUnique({ where: { id: data.parentId, deletedAt: null } });
    if (!parent) throw new ParentNotFoundError();
    if (parent.depth >= 2) throw new SubtaskDepthExceededError();
    depth = parent.depth + 1;
  }

  if (data.assigneeIds?.length) {
    const count = await prisma.projectMember.count({
      where: { projectId, userId: { in: data.assigneeIds } },
    });
    if (count !== data.assigneeIds.length) throw new ForbiddenError();
  }

  if (data.labelIds?.length) {
    const count = await prisma.label.count({
      where: { id: { in: data.labelIds }, projectId },
    });
    if (count !== data.labelIds.length) throw new ForbiddenError();
  }

  const maxPos = await prisma.task.aggregate({
    where: { projectId, parentId: data.parentId ?? null, deletedAt: null },
    _max: { position: true },
  });
  const position = Number(maxPos._max.position ?? 0) + 1;

  const id = newId();
  const created = await prisma.task.create({
    data: {
      id,
      projectId,
      createdById,
      depth,
      position,
      title: data.title,
      description: data.description,
      status: data.status ?? 'TODO',
      priority: data.priority ?? 'MEDIUM',
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      parentId: data.parentId,
      ...(data.assigneeIds?.length
        ? { assignees: { create: data.assigneeIds.map((uid) => ({ userId: uid, assignedBy: createdById })) } }
        : {}),
      ...(data.labelIds?.length
        ? { labels: { create: data.labelIds.map((lid) => ({ labelId: lid })) } }
        : {}),
    },
    select: TASK_SELECT,
  });
  return flattenRelations(created);
}

export async function listTasks(prisma: PrismaClient, projectId: string, query: ListTasksQuery) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const sort = query.sort ?? 'position';

  const orderBy = sort === 'position'
    ? [{ position: 'asc' as const }, { id: 'asc' as const }]
    : sort === 'dueDate'
    ? [{ dueDate: 'asc' as const }, { id: 'asc' as const }]
    : sort === 'movedAt'
    ? [{ movedAt: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'desc' as const }, { id: 'desc' as const }]
    : [{ [sort]: 'desc' as const }, { id: 'desc' as const }];

  let cursorWhere: object = {};
  if (cursor) {
    if (sort === 'position') {
      const v = Number(cursor.v);
      cursorWhere = { OR: [{ position: { gt: v } }, { position: v, id: { gt: cursor.id } }] };
    } else if (sort === 'dueDate') {
      const v = new Date(cursor.v);
      cursorWhere = { OR: [{ dueDate: { gt: v } }, { dueDate: v, id: { gt: cursor.id } }] };
    } else if (sort === 'createdAt') {
      const v = new Date(cursor.v);
      cursorWhere = { OR: [{ createdAt: { lt: v } }, { createdAt: v, id: { lt: cursor.id } }] };
    } else if (sort === 'movedAt') {
      const v = new Date(cursor.v);
      // cursor.v is the effective date (movedAt ?? createdAt); match on the same field used for the last item
      cursorWhere = {
        OR: [
          { movedAt: { lt: v } },
          { movedAt: v, id: { lt: cursor.id } },
          { movedAt: null, createdAt: { lt: v } },
          { movedAt: null, createdAt: v, id: { lt: cursor.id } },
        ],
      };
    }
    // priority sort: no reliable cursor (enum ordering); falls back to full re-fetch — acceptable
  }

  const archivedFilter =
    query.archived === 'only'
      ? { archivedAt: { not: null } }
      : query.archived === 'include'
      ? {}
      : { archivedAt: null };

  const items = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...archivedFilter,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assignees: { some: { userId: query.assigneeId } } } : {}),
      ...(query.labelId ? { labels: { some: { labelId: query.labelId } } } : {}),
      ...(query.parentId !== undefined ? { parentId: query.parentId } : {}),
      ...cursorWhere,
    },
    orderBy,
    take: limit + 1,
    select: TASK_SELECT,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const flatItems = items.map(flattenRelations);

  const getSortValue = (item: (typeof items)[0]): string | number => {
    if (sort === 'createdAt') return item.createdAt.toISOString();
    if (sort === 'movedAt') return item.movedAt?.toISOString() ?? item.createdAt.toISOString();
    if (sort === 'dueDate') return item.dueDate?.toISOString() ?? '';
    return Number(item.position);
  };

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: getSortValue(items[items.length - 1]!), id: items[items.length - 1]!.id })
      : null;

  return { items: flatItems, nextCursor };
}

export async function getTask(prisma: PrismaClient, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      assignees: { include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } } },
      labels: { include: { label: true } },
      dependencies: { include: { toTask: { select: { id: true, title: true, status: true } } } },
      dependents: { include: { fromTask: { select: { id: true, title: true, status: true } } } },
    },
  });
  if (!task) throw new TaskNotFoundError();
  return {
    ...task,
    assignees: task.assignees.map((a) => a.user),
    labels: task.labels.map((l) => l.label),
  };
}

export async function updateTask(prisma: PrismaClient, taskId: string, data: UpdateTaskBody) {
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new TaskNotFoundError();

  if (data.status && data.status !== task.status) {
    const allowed = STATUS_TRANSITIONS[task.status];
    if (!allowed.includes(data.status as TaskStatus)) {
      throw new InvalidStatusTransitionError(task.status, data.status);
    }
  }

  const statusChanged = !!data.status && data.status !== task.status;

  const isNowDone = data.status === 'DONE';
  const completedAt = isNowDone
    ? (task.completedAt ?? new Date())
    : data.status
    ? null
    : undefined;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
      completedAt,
      movedAt: statusChanged ? new Date() : undefined,
    },
    select: TASK_SELECT,
  });
  return flattenRelations(updated);
}

export async function moveTask(prisma: PrismaClient, taskId: string, targetProjectId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null }, select: { projectId: true } });
  if (!task) throw new TaskNotFoundError();

  if (task.projectId === targetProjectId) return;

  const last = await prisma.task.findFirst({
    where: { projectId: targetProjectId, parentId: null, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (Number(last?.position ?? 0)) + 1000;

  // Labels are project-scoped — clear them all
  await prisma.taskLabel.deleteMany({ where: { taskId } });

  // Keep only assignees who are members of the target project
  const targetMemberIds = (
    await prisma.projectMember.findMany({ where: { projectId: targetProjectId }, select: { userId: true } })
  ).map((m) => m.userId);
  await prisma.taskAssignee.deleteMany({ where: { taskId, userId: { notIn: targetMemberIds } } });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { projectId: targetProjectId, position },
    select: TASK_SELECT,
  });
  return flattenRelations(updated);
}

export async function deleteTask(prisma: PrismaClient, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new TaskNotFoundError();
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE tasks SET deleted_at = ${now}
    WHERE (id = ${taskId}::uuid OR parent_id = ${taskId}::uuid)
    AND deleted_at IS NULL
  `;
}

export async function restoreTask(prisma: PrismaClient, taskId: string) {
  // Use explicit deletedAt filter to bypass the soft-delete extension (which auto-injects deletedAt: null)
  const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: { not: null } } });
  if (!task) throw new TaskNotFoundError();

  const retentionMs = config.SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - task.deletedAt!.getTime() > retentionMs) throw new RestoreWindowExpiredError();

  const restored = await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: null },
    select: TASK_SELECT,
  });
  return flattenRelations(restored);
}

const ARCHIVABLE_STATUSES = ['DONE', 'CANCELLED'] as const;

async function getUserThresholdMs(prisma: PrismaClient, userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: { archiveThresholdDays: true },
  });
  return (user?.archiveThresholdDays ?? 14) * 24 * 60 * 60 * 1000;
}

export async function archiveTask(prisma: PrismaClient, taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new TaskNotFoundError();
  if (!(ARCHIVABLE_STATUSES as readonly string[]).includes(task.status))
    throw new TaskNotArchivableError();

  const thresholdMs = await getUserThresholdMs(prisma, userId);
  if (Date.now() - task.createdAt.getTime() < thresholdMs)
    throw new TaskNotArchivableError();

  const now = new Date();
  const cutoff = new Date(Date.now() - thresholdMs);
  await prisma.$executeRaw`
    UPDATE tasks SET archived_at = ${now}
    WHERE (id = ${taskId}::uuid OR parent_id = ${taskId}::uuid)
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status IN ('DONE', 'CANCELLED')
    AND created_at < ${cutoff}
  `;
  const updated = await prisma.task.findUnique({ where: { id: taskId }, select: TASK_SELECT });
  return flattenRelations(updated!);
}

export async function unarchiveTask(prisma: PrismaClient, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, archivedAt: { not: null } },
  });
  if (!task) throw new TaskNotFoundError();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null },
    select: TASK_SELECT,
  });
  return flattenRelations(updated);
}

export async function archiveOldTasks(prisma: PrismaClient, projectId: string, userId: string, query: ArchiveTasksQuery) {
  const thresholdMs = await getUserThresholdMs(prisma, userId);
  const cutoff = new Date(Date.now() - thresholdMs);
  const [parentCount] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count FROM tasks
    WHERE project_id = ${projectId}::uuid
    AND parent_id IS NULL
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status IN ('DONE', 'CANCELLED')
    AND created_at < ${cutoff}
  `;
  await prisma.$executeRaw`
    UPDATE tasks SET archived_at = NOW()
    WHERE project_id = ${projectId}::uuid
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND status IN ('DONE', 'CANCELLED')
    AND created_at < ${cutoff}
  `;
  return { archivedCount: Number(parentCount.count) };
}

export async function listSubtasks(prisma: PrismaClient, taskId: string, query: { cursor?: string; limit?: number }) {
  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const items = await prisma.task.findMany({
    where: {
      parentId: taskId,
      deletedAt: null,
      ...(cursor
        ? { OR: [{ position: { gt: Number(cursor.v) } }, { position: Number(cursor.v), id: { gt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    select: TASK_SELECT,
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor =
    hasMore && items.length > 0
      ? encodeCursor({ v: Number(items[items.length - 1]!.position), id: items[items.length - 1]!.id })
      : null;

  return { items: items.map(flattenRelations), nextCursor };
}
