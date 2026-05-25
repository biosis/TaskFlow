import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

export async function searchTasks(
  prisma: PrismaClient,
  projectId: string,
  q: string,
  limit: number,
) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      project_id: string;
      sim: number;
    }>
  >(
    Prisma.sql`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.project_id,
             GREATEST(
               similarity(t.title, ${q}),
               similarity(COALESCE(t.description, ''), ${q})
             ) AS sim
      FROM tasks t
      WHERE t.project_id = ${projectId}::uuid
        AND t.deleted_at IS NULL
        AND t.archived_at IS NULL
        AND (t.title % ${q} OR t.description % ${q})
      ORDER BY sim DESC, t.id DESC
      LIMIT ${limit}
    `,
  );
}
