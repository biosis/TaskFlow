import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

export default fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { algorithm: 'HS256', expiresIn: config.JWT_ACCESS_TTL },
  });
});
