import type { PrismaClient } from '@prisma/client';
import { newId } from '../../utils/id.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import type { CreateLabelBody, UpdateLabelBody } from './labels.schema.js';

export async function createLabel(prisma: PrismaClient, projectId: string, data: CreateLabelBody) {
  return prisma.label.create({ data: { id: newId(), projectId, ...data } });
}

export async function listLabels(prisma: PrismaClient, projectId: string) {
  return prisma.label.findMany({ where: { projectId }, orderBy: { name: 'asc' } });
}

export async function updateLabel(prisma: PrismaClient, labelId: string, data: UpdateLabelBody) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new NotFoundError('Label');
  return prisma.label.update({ where: { id: labelId }, data });
}

export async function deleteLabel(prisma: PrismaClient, labelId: string) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new NotFoundError('Label');
  await prisma.label.delete({ where: { id: labelId } });
}

export async function addTaskLabel(prisma: PrismaClient, taskId: string, labelId: string) {
  const [task, label] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } }),
    prisma.label.findUnique({ where: { id: labelId }, select: { projectId: true } }),
  ]);
  if (!task) throw new NotFoundError('Task');
  if (!label) throw new NotFoundError('Label');
  if (task.projectId !== label.projectId) throw new ForbiddenError();
  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    create: { taskId, labelId },
    update: {},
  });
}

export async function removeTaskLabel(prisma: PrismaClient, taskId: string, labelId: string) {
  await prisma.taskLabel.deleteMany({ where: { taskId, labelId } });
}
