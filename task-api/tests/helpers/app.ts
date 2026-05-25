import { buildApp } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export interface InjectOpts {
  token?: string;
  body?: unknown;
  cookie?: string;
}

export function makeInject(app: FastifyInstance) {
  return (method: string, url: string, opts: InjectOpts = {}) =>
    app.inject({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url,
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      payload: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
}

export function getCookie(res: Awaited<ReturnType<FastifyInstance['inject']>>, name: string): string | undefined {
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const c of cookies) {
    const [pair] = c.split(';');
    const [key, value] = pair!.split('=');
    if (key?.trim() === name) return value?.trim();
  }
  return undefined;
}
