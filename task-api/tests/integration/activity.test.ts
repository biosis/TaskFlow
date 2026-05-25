import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, createTask, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Activity routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  it('records activity when creating a task', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);

    await inject('POST', `/api/v1/projects/${project.id}/tasks`, {
      token: tokenFor(owner),
      body: { title: 'New Task' },
    });

    const res = await inject('GET', `/api/v1/projects/${project.id}/activity`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(200);
    const { items } = res.json<{ items: { action: string }[] }>();
    expect(items.some((a) => a.action === 'TASK_CREATED')).toBe(true);
  });

  it('lists task-level activity', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);

    await inject('PATCH', `/api/v1/tasks/${task.id}`, {
      token: tokenFor(owner),
      body: { status: 'IN_PROGRESS' },
    });

    const res = await inject('GET', `/api/v1/tasks/${task.id}/activity`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(200);
    const { items: taskItems } = res.json<{ items: { action: string }[] }>();
    expect(taskItems.some((a) => a.action === 'TASK_STATUS_CHANGED')).toBe(true);
  });

  it('lists user activity feed', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);

    await inject('POST', `/api/v1/projects/${project.id}/tasks`, {
      token: tokenFor(owner),
      body: { title: 'User Activity Task' },
    });

    const res = await inject('GET', '/api/v1/users/me/activity', {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-member accessing project activity', async () => {
    const owner = await createUser(app);
    const other = await createUser(app);
    const project = await createProject(app, owner.id);

    const res = await inject('GET', `/api/v1/projects/${project.id}/activity`, {
      token: tokenFor(other),
    });
    expect(res.statusCode).toBe(404);
  });
});
