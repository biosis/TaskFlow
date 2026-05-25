import bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { signAccess } from '../../src/utils/tokens.js';

export const DEFAULT_PASSWORD = 'Password1!';

export async function createUser(
  app: FastifyInstance,
  overrides: { email?: string; displayName?: string } = {},
) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 4);
  return app.prisma.user.create({
    data: {
      id: uuidv7(),
      email: overrides.email ?? `user-${uuidv7()}@test.local`,
      passwordHash,
      displayName: overrides.displayName ?? 'Test User',
    },
  });
}

export async function createProject(
  app: FastifyInstance,
  ownerId: string,
  overrides: { name?: string } = {},
) {
  const project = await app.prisma.project.create({
    data: {
      id: uuidv7(),
      name: overrides.name ?? 'Test Project',
      ownerId,
    },
  });
  await app.prisma.projectMember.create({
    data: { projectId: project.id, userId: ownerId, role: 'OWNER' },
  });
  return project;
}

export async function addMember(
  app: FastifyInstance,
  projectId: string,
  userId: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER',
) {
  return app.prisma.projectMember.create({
    data: { projectId, userId, role },
  });
}

export async function createTask(
  app: FastifyInstance,
  projectId: string,
  createdById: string,
  overrides: { title?: string; status?: string; priority?: string } = {},
) {
  return app.prisma.task.create({
    data: {
      id: uuidv7(),
      projectId,
      createdById,
      title: overrides.title ?? 'Test Task',
      status: (overrides.status ?? 'TODO') as never,
      priority: (overrides.priority ?? 'MEDIUM') as never,
    },
  });
}

export function tokenFor(user: { id: string; email: string }): string {
  return signAccess({ sub: user.id, email: user.email });
}
