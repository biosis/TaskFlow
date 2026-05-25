import { createTestApp, makeInject, getCookie } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, tokenFor, DEFAULT_PASSWORD } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Auth routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });

  beforeEach(async () => { await cleanDb(app); });

  const BASE = '/api/v1/auth';
  const validBody = { email: 'alice@test.local', password: 'Password1!', displayName: 'Alice' };

  describe('POST /register', () => {
    it('returns 201 with user and accessToken', async () => {
      const res = await inject('POST', `${BASE}/register`, { body: validBody });
      expect(res.statusCode).toBe(201);
      const body = res.json<{ user: { email: string }; accessToken: string }>();
      expect(body.user.email).toBe('alice@test.local');
      expect(body.accessToken).toBeDefined();
    });

    it('sets httpOnly rt cookie', async () => {
      const res = await inject('POST', `${BASE}/register`, { body: validBody });
      const rt = getCookie(res, 'rt');
      expect(rt).toBeDefined();
    });

    it('returns 409 for duplicate email', async () => {
      await inject('POST', `${BASE}/register`, { body: validBody });
      const res = await inject('POST', `${BASE}/register`, { body: validBody });
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 for weak password', async () => {
      const res = await inject('POST', `${BASE}/register`, {
        body: { ...validBody, password: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await inject('POST', `${BASE}/register`, { body: validBody });
    });

    it('returns 200 with accessToken', async () => {
      const res = await inject('POST', `${BASE}/login`, {
        body: { email: 'alice@test.local', password: DEFAULT_PASSWORD },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ accessToken: string }>().accessToken).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const res = await inject('POST', `${BASE}/login`, {
        body: { email: 'alice@test.local', password: 'WrongPass1!' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await inject('POST', `${BASE}/login`, {
        body: { email: 'nobody@test.local', password: DEFAULT_PASSWORD },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /refresh', () => {
    it('issues a new access token using the rt cookie', async () => {
      const reg = await inject('POST', `${BASE}/register`, { body: validBody });
      const rtCookie = getCookie(reg, 'rt');
      expect(rtCookie).toBeDefined();

      const res = await inject('POST', `${BASE}/refresh`, {
        cookie: `rt=${rtCookie}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ accessToken: string }>().accessToken).toBeDefined();
    });

    it('returns 401 without cookie', async () => {
      const res = await inject('POST', `${BASE}/refresh`);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('returns 204 and clears cookie', async () => {
      const reg = await inject('POST', `${BASE}/register`, { body: validBody });
      const rt = getCookie(reg, 'rt');
      const { accessToken } = reg.json<{ accessToken: string }>();

      const res = await inject('POST', `${BASE}/logout`, {
        token: accessToken,
        cookie: `rt=${rt}`,
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('GET /me', () => {
    it('returns the authenticated user', async () => {
      const user = await createUser(app, { email: 'bob@test.local' });
      const token = tokenFor(user);
      const res = await inject('GET', `${BASE}/me`, { token });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ user: { id: string } }>().user.id).toBe(user.id);
    });

    it('returns 401 without token', async () => {
      const res = await inject('GET', `${BASE}/me`);
      expect(res.statusCode).toBe(401);
    });
  });
});
