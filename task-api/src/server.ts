import Fastify from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';

import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { registerGlobalRateLimit } from './middleware/rate-limit.js';

import prismaPlugin from './plugins/prisma.plugin.js';
import redisPlugin from './plugins/redis.plugin.js';
import cookiePlugin from './plugins/cookie.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { projectsRoutes } from './modules/projects/projects.routes.js';
import { projectTaskRoutes, taskRoutes } from './modules/tasks/tasks.routes.js';
import { projectLabelRoutes, labelRoutes, taskLabelRoutes } from './modules/labels/labels.routes.js';
import { taskCommentRoutes, commentRoutes } from './modules/comments/comments.routes.js';
import { taskAttachmentRoutes, attachmentRoutes } from './modules/attachments/attachments.routes.js';
import { projectActivityRoutes, taskActivityRoutes, userActivityRoutes } from './modules/activity/activity.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { ActivityEmitter } from './modules/activity/activity.emitter.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
    trustProxy: true,
  });

  fastify.setValidatorCompiler(({ schema }) => {
    if (schema && typeof schema === 'object' && 'safeParse' in schema) {
      const zodSchema = schema as z.ZodTypeAny;
      return (data) => {
        const result = zodSchema.safeParse(data);
        if (result.success) return { value: result.data };
        return { error: result.error as Error };
      };
    }
    return (data) => ({ value: data });
  });

  // Config decoration
  fastify.decorate('config', config);

  // Infrastructure plugins
  await fastify.register(sensible);
  await fastify.register(helmet, { global: true });
  await fastify.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
    credentials: true,
  });
  await fastify.register(cookiePlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(swaggerPlugin);

  // Rate limiting (requires redis)
  await registerGlobalRateLimit(fastify);

  // Request context + error handler
  fastify.addHook('onRequest', requestContext);
  registerErrorHandler(fastify);

  // Activity emitter (request-scoped)
  fastify.addHook('onRequest', async (request) => {
    (request as typeof request & { activityEmitter: ActivityEmitter }).activityEmitter =
      new ActivityEmitter();
  });

  fastify.addHook('onSend', async (request, _reply) => {
    const emitter = (request as typeof request & { activityEmitter?: ActivityEmitter }).activityEmitter;
    if (emitter) await emitter.flush(fastify.prisma).catch(() => {});
  });

  // Access log
  fastify.addHook('onResponse', async (request, reply) => {
    logger.info({
      requestId: request.requestId,
      userId: request.user?.id,
      method: request.method,
      url: request.url,
      status: reply.statusCode,
    });
  });

  // Routes
  const v1 = '/api/v1';
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: `${v1}/auth` });
  await fastify.register(usersRoutes, { prefix: `${v1}/users` });
  await fastify.register(projectsRoutes, { prefix: `${v1}/projects` });
  await fastify.register(projectTaskRoutes, { prefix: `${v1}/projects/:pid/tasks` });
  await fastify.register(taskRoutes, { prefix: `${v1}/tasks` });
  await fastify.register(projectLabelRoutes, { prefix: `${v1}/projects/:pid/labels` });
  await fastify.register(labelRoutes, { prefix: `${v1}/labels` });
  await fastify.register(taskLabelRoutes, { prefix: `${v1}/tasks/:id/labels` });
  await fastify.register(taskCommentRoutes, { prefix: `${v1}/tasks/:id/comments` });
  await fastify.register(commentRoutes, { prefix: `${v1}/comments` });
  await fastify.register(taskAttachmentRoutes, { prefix: `${v1}/tasks/:id/attachments` });
  await fastify.register(attachmentRoutes, { prefix: `${v1}/attachments` });
  await fastify.register(projectActivityRoutes, { prefix: `${v1}/projects/:pid/activity` });
  await fastify.register(taskActivityRoutes, { prefix: `${v1}/tasks/:id/activity` });
  await fastify.register(userActivityRoutes, { prefix: `${v1}/users/me/activity` });

  return fastify;
}
