import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: Error, request: FastifyRequest, reply: FastifyReply): void => {
      const requestId = (request as FastifyRequest & { requestId?: string }).requestId ?? 'unknown';

      if (error instanceof AppError) {
        void reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message, details: error.details },
          requestId,
        });
        return;
      }

      if (error instanceof ZodError) {
        void reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors,
          },
          requestId,
        });
        return;
      }

      // Prisma known request errors
      if ('code' in error) {
        const prismaError = error as Error & { code: string };
        if (prismaError.code === 'P2002') {
          void reply.status(409).send({
            error: { code: 'CONFLICT', message: 'Resource already exists', details: [] },
            requestId,
          });
          return;
        }
        if (prismaError.code === 'P2025') {
          void reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Resource not found', details: [] },
            requestId,
          });
          return;
        }
      }

      logger.error({ err: error, requestId }, 'Unhandled error');
      void reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] },
        requestId,
      });
    },
  );
}
