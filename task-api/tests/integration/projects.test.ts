import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Projects routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  const BASE = '/api/v1/projects';

  describe('POST /', () => {
    it('creates a project and returns 201', async () => {
      const owner = await createUser(app);
      const token = tokenFor(owner);
      const res = await inject('POST', BASE, {
        token,
        body: { name: 'My Project', description: 'desc' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<{ project: { name: string; ownerId: string } }>();
      expect(body.project.name).toBe('My Project');
      expect(body.project.ownerId).toBe(owner.id);
    });

    it('returns 401 without token', async () => {
      const res = await inject('POST', BASE, { body: { name: 'X' } });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /', () => {
    it('lists only projects the user is a member of', async () => {
      const owner = await createUser(app);
      const other = await createUser(app);
      await createProject(app, owner.id, { name: 'Owned' });
      await createProject(app, other.id, { name: 'Foreign' });

      const res = await inject('GET', BASE, { token: tokenFor(owner) });
      expect(res.statusCode).toBe(200);
      const { items } = res.json<{ items: { name: string }[] }>();
      expect(items).toHaveLength(1);
      expect(items[0]!.name).toBe('Owned');
    });
  });

  describe('GET /:pid', () => {
    it('returns the project for a member', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const res = await inject('GET', `${BASE}/${project.id}`, { token: tokenFor(owner) });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ project: { id: string } }>().project.id).toBe(project.id);
    });

    it('returns 404 for non-member (existence hidden)', async () => {
      const owner = await createUser(app);
      const other = await createUser(app);
      const project = await createProject(app, owner.id);
      const res = await inject('GET', `${BASE}/${project.id}`, { token: tokenFor(other) });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /:pid', () => {
    it('allows OWNER to update project', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const res = await inject('PATCH', `${BASE}/${project.id}`, {
        token: tokenFor(owner),
        body: { name: 'Updated Name' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ project: { name: string } }>().project.name).toBe('Updated Name');
    });

    it('returns 403 for MEMBER trying to update', async () => {
      const owner = await createUser(app);
      const member = await createUser(app);
      const project = await createProject(app, owner.id);
      await app.prisma.projectMember.create({
        data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
      });
      const res = await inject('PATCH', `${BASE}/${project.id}`, {
        token: tokenFor(member),
        body: { name: 'Hack' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /:pid', () => {
    it('soft-deletes the project', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const res = await inject('DELETE', `${BASE}/${project.id}`, { token: tokenFor(owner) });
      expect(res.statusCode).toBe(204);

      const deleted = await app.prisma.$queryRaw<{ deleted_at: Date | null }[]>`
        SELECT deleted_at FROM projects WHERE id = ${project.id}::uuid
      `;
      expect(deleted[0]?.deleted_at).not.toBeNull();
    });
  });

  describe('Members', () => {
    it('OWNER can add a member', async () => {
      const owner = await createUser(app);
      const newMember = await createUser(app);
      const project = await createProject(app, owner.id);

      const res = await inject('POST', `${BASE}/${project.id}/members`, {
        token: tokenFor(owner),
        body: { email: newMember.email, role: 'MEMBER' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('MEMBER cannot add another member', async () => {
      const owner = await createUser(app);
      const member = await createUser(app);
      const stranger = await createUser(app);
      const project = await createProject(app, owner.id);
      await app.prisma.projectMember.create({
        data: { projectId: project.id, userId: member.id, role: 'MEMBER' },
      });

      const res = await inject('POST', `${BASE}/${project.id}/members`, {
        token: tokenFor(member),
        body: { email: stranger.email, role: 'MEMBER' },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
