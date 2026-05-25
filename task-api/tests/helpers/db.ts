import type { FastifyInstance } from 'fastify';

export async function cleanDb(app: FastifyInstance): Promise<void> {
  await app.prisma.$executeRaw`
    TRUNCATE TABLE
      activities,
      task_labels,
      task_assignees,
      task_dependencies,
      comments,
      tasks,
      labels,
      project_members,
      refresh_sessions,
      projects,
      users
    RESTART IDENTITY CASCADE
  `;
}
