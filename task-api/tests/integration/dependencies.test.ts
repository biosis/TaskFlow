import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, createTask, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Task dependencies routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  it('adds a dependency between tasks', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const taskA = await createTask(app, project.id, owner.id, { title: 'A' });
    const taskB = await createTask(app, project.id, owner.id, { title: 'B' });

    const res = await inject('POST', `/api/v1/tasks/${taskA.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: taskB.id },
    });
    expect(res.statusCode).toBe(201);
  });

  it('removes a dependency', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const taskA = await createTask(app, project.id, owner.id, { title: 'A' });
    const taskB = await createTask(app, project.id, owner.id, { title: 'B' });

    await inject('POST', `/api/v1/tasks/${taskA.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: taskB.id },
    });

    const res = await inject('DELETE', `/api/v1/tasks/${taskA.id}/dependencies/${taskB.id}`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(204);
  });

  it('detects a direct cycle (A→B, B→A)', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const taskA = await createTask(app, project.id, owner.id, { title: 'A' });
    const taskB = await createTask(app, project.id, owner.id, { title: 'B' });

    await inject('POST', `/api/v1/tasks/${taskA.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: taskB.id },
    });

    const res = await inject('POST', `/api/v1/tasks/${taskB.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: taskA.id },
    });
    expect(res.statusCode).toBe(422);
  });

  it('detects a transitive cycle (A→B→C→A)', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const A = await createTask(app, project.id, owner.id, { title: 'A' });
    const B = await createTask(app, project.id, owner.id, { title: 'B' });
    const C = await createTask(app, project.id, owner.id, { title: 'C' });

    await inject('POST', `/api/v1/tasks/${A.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: B.id },
    });
    await inject('POST', `/api/v1/tasks/${B.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: C.id },
    });

    const res = await inject('POST', `/api/v1/tasks/${C.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: A.id },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns 404 for dependency on non-member task', async () => {
    const owner = await createUser(app);
    const other = await createUser(app);
    const p1 = await createProject(app, owner.id);
    const p2 = await createProject(app, other.id);
    const taskA = await createTask(app, p1.id, owner.id);
    const taskB = await createTask(app, p2.id, other.id);

    const res = await inject('POST', `/api/v1/tasks/${taskA.id}/dependencies`, {
      token: tokenFor(owner),
      body: { dependsOnTaskId: taskB.id },
    });
    expect(res.statusCode).toBe(404);
  });
});
