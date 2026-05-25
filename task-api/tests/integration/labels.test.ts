import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, createTask, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Labels routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  async function createLabel(projectId: string, token: string, name = 'Bug', color = '#ff0000') {
    const res = await inject('POST', `/api/v1/projects/${projectId}/labels`, {
      token,
      body: { name, color },
    });
    return res.json<{ label: { id: string; name: string } }>().label;
  }

  it('creates a label for a project', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const res = await inject('POST', `/api/v1/projects/${project.id}/labels`, {
      token: tokenFor(owner),
      body: { name: 'Bug', color: '#ff0000' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ label: { name: string } }>().label.name).toBe('Bug');
  });

  it('lists labels for a project', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    await createLabel(project.id, tokenFor(owner), 'Bug');
    await createLabel(project.id, tokenFor(owner), 'Feature');

    const res = await inject('GET', `/api/v1/projects/${project.id}/labels`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ labels: unknown[] }>().labels).toHaveLength(2);
  });

  it('updates a label', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const label = await createLabel(project.id, tokenFor(owner));

    const res = await inject('PATCH', `/api/v1/labels/${label.id}`, {
      token: tokenFor(owner),
      body: { name: 'Critical' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ label: { name: string } }>().label.name).toBe('Critical');
  });

  it('deletes a label', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const label = await createLabel(project.id, tokenFor(owner));

    const res = await inject('DELETE', `/api/v1/labels/${label.id}`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(204);
  });

  it('adds a label to a task', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);
    const label = await createLabel(project.id, tokenFor(owner));

    const res = await inject('POST', `/api/v1/tasks/${task.id}/labels`, {
      token: tokenFor(owner),
      body: { labelId: label.id },
    });
    expect(res.statusCode).toBe(201);
  });

  it('removes a label from a task', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);
    const label = await createLabel(project.id, tokenFor(owner));

    await inject('POST', `/api/v1/tasks/${task.id}/labels`, {
      token: tokenFor(owner),
      body: { labelId: label.id },
    });

    const res = await inject('DELETE', `/api/v1/tasks/${task.id}/labels/${label.id}`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(204);
  });
});
