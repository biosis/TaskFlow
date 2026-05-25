import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, createTask, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Tasks routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  describe('POST /api/v1/projects/:pid/tasks', () => {
    it('creates a task', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const token = tokenFor(owner);

      const res = await inject('POST', `/api/v1/projects/${project.id}/tasks`, {
        token,
        body: { title: 'My Task', priority: 'HIGH' },
      });
      expect(res.statusCode).toBe(201);
      const { task } = res.json<{ task: { title: string; status: string } }>();
      expect(task.title).toBe('My Task');
      expect(task.status).toBe('TODO');
    });

    it('returns 404 for non-member', async () => {
      const owner = await createUser(app);
      const other = await createUser(app);
      const project = await createProject(app, owner.id);
      const res = await inject('POST', `/api/v1/projects/${project.id}/tasks`, {
        token: tokenFor(other),
        body: { title: 'Sneaky' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/projects/:pid/tasks', () => {
    it('lists tasks in a project', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      await createTask(app, project.id, owner.id, { title: 'T1' });
      await createTask(app, project.id, owner.id, { title: 'T2' });

      const res = await inject('GET', `/api/v1/projects/${project.id}/tasks`, {
        token: tokenFor(owner),
      });
      expect(res.statusCode).toBe(200);
      const { items } = res.json<{ items: { title: string }[] }>();
      expect(items).toHaveLength(2);
    });

    it('supports search query', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      await createTask(app, project.id, owner.id, { title: 'Alpha feature' });
      await createTask(app, project.id, owner.id, { title: 'Beta work' });

      const res = await inject('GET', `/api/v1/projects/${project.id}/tasks/search?q=Alpha`, {
        token: tokenFor(owner),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('updates a task title', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id);

      const res = await inject('PATCH', `/api/v1/tasks/${task.id}`, {
        token: tokenFor(owner),
        body: { title: 'Updated Title' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ task: { title: string } }>().task.title).toBe('Updated Title');
    });

    it('transitions status from TODO to IN_PROGRESS', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id, { status: 'TODO' });

      const res = await inject('PATCH', `/api/v1/tasks/${task.id}`, {
        token: tokenFor(owner),
        body: { status: 'IN_PROGRESS' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ task: { status: string } }>().task.status).toBe('IN_PROGRESS');
    });

    it('allows status transition TODO → DONE', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id, { status: 'TODO' });

      const res = await inject('PATCH', `/api/v1/tasks/${task.id}`, {
        token: tokenFor(owner),
        body: { status: 'DONE' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('sets completedAt when transitioning to DONE', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id, { status: 'IN_PROGRESS' });

      const res = await inject('PATCH', `/api/v1/tasks/${task.id}`, {
        token: tokenFor(owner),
        body: { status: 'DONE' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ task: { completedAt: string | null } }>().task.completedAt).not.toBeNull();
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('soft-deletes a task', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id);

      const res = await inject('DELETE', `/api/v1/tasks/${task.id}`, { token: tokenFor(owner) });
      expect(res.statusCode).toBe(204);

      const row = await app.prisma.$queryRaw<{ deleted_at: Date | null }[]>`
        SELECT deleted_at FROM tasks WHERE id = ${task.id}::uuid
      `;
      expect(row[0]?.deleted_at).not.toBeNull();
    });
  });

  describe('Assignees', () => {
    it('adds an assignee to a task', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id);

      const res = await inject('POST', `/api/v1/tasks/${task.id}/assignees`, {
        token: tokenFor(owner),
        body: { userId: owner.id },
      });
      expect(res.statusCode).toBe(201);
    });

    it('removes an assignee', async () => {
      const owner = await createUser(app);
      const project = await createProject(app, owner.id);
      const task = await createTask(app, project.id, owner.id);
      await app.prisma.taskAssignee.create({
        data: { taskId: task.id, userId: owner.id, assignedBy: owner.id },
      });

      const res = await inject('DELETE', `/api/v1/tasks/${task.id}/assignees/${owner.id}`, {
        token: tokenFor(owner),
      });
      expect(res.statusCode).toBe(204);
    });
  });
});
