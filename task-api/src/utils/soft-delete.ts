import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = ['Task', 'Project', 'Comment'] as const;

type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

function isSoftDeleteModel(model: string | undefined): model is SoftDeleteModel {
  return SOFT_DELETE_MODELS.includes(model as SoftDeleteModel);
}

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            const typedArgs = args as { where?: { deletedAt?: unknown } };
            if (!typedArgs.where) typedArgs.where = {};
            if (typedArgs.where.deletedAt === undefined) {
              typedArgs.where.deletedAt = null;
            }
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            const typedArgs = args as { where?: { deletedAt?: unknown } };
            if (!typedArgs.where) typedArgs.where = {};
            if (typedArgs.where.deletedAt === undefined) {
              typedArgs.where.deletedAt = null;
            }
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            const typedArgs = args as { where?: { deletedAt?: unknown } };
            if (!typedArgs.where) typedArgs.where = {};
            if ((typedArgs.where as Record<string, unknown>).deletedAt === undefined) {
              (typedArgs.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            const typedArgs = args as unknown as Parameters<
              typeof client.task.update
            >[0];
            return (client[model.toLowerCase() as 'task'] as typeof client.task).update({
              where: typedArgs.where as Parameters<typeof client.task.update>[0]['where'],
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            const typedArgs = args as unknown as Parameters<
              typeof client.task.updateMany
            >[0];
            return (client[model.toLowerCase() as 'task'] as typeof client.task).updateMany({
              where: typedArgs.where as Parameters<typeof client.task.updateMany>[0]['where'],
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
      },
    },
  }),
);

export function withDeleted<T extends { where?: { deletedAt?: unknown } }>(args: T): T {
  return {
    ...args,
    where: {
      ...args.where,
      deletedAt: undefined,
    },
  };
}
