import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from '../config.js';

export default fp(async (fastify) => {
  if (config.NODE_ENV === 'production' && !config.ENABLE_SWAGGER) return;

  await fastify.register(fastifySwagger, {
    openapi: {
      info: { title: 'Task Management API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await fastify.register(fastifySwaggerUi, { routePrefix: '/docs' });
});
