import { createTestApp, makeInject } from '../helpers/app.js';
import { cleanDb } from '../helpers/db.js';
import { createUser, createProject, createTask, addMember, tokenFor } from '../helpers/factories.js';
import type { FastifyInstance } from 'fastify';

describe('Comments routes', () => {
  let app: FastifyInstance;
  let inject: ReturnType<typeof makeInject>;

  beforeAll(async () => {
    app = await createTestApp();
    inject = makeInject(app);
  });

  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await cleanDb(app); });

  it('creates a comment on a task', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);

    const res = await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'Hello world' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ comment: { body: string } }>().comment.body).toBe('Hello world');
  });

  it('lists comments for a task', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);
    await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'First' },
    });
    await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'Second' },
    });

    const res = await inject('GET', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ items: unknown[] }>().items).toHaveLength(2);
  });

  it('allows author to update their comment', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);
    const created = await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'Original' },
    });
    const commentId = created.json<{ comment: { id: string } }>().comment.id;

    const res = await inject('PATCH', `/api/v1/comments/${commentId}`, {
      token: tokenFor(owner),
      body: { body: 'Updated' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ comment: { body: string } }>().comment.body).toBe('Updated');
  });

  it('prevents non-author from updating a comment', async () => {
    const owner = await createUser(app);
    const other = await createUser(app);
    const project = await createProject(app, owner.id);
    await addMember(app, project.id, other.id, 'MEMBER');
    const task = await createTask(app, project.id, owner.id);

    const created = await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'Mine' },
    });
    const commentId = created.json<{ comment: { id: string } }>().comment.id;

    const res = await inject('PATCH', `/api/v1/comments/${commentId}`, {
      token: tokenFor(other),
      body: { body: 'Hacked' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('soft-deletes a comment', async () => {
    const owner = await createUser(app);
    const project = await createProject(app, owner.id);
    const task = await createTask(app, project.id, owner.id);
    const created = await inject('POST', `/api/v1/tasks/${task.id}/comments`, {
      token: tokenFor(owner),
      body: { body: 'Delete me' },
    });
    const commentId = created.json<{ comment: { id: string } }>().comment.id;

    const res = await inject('DELETE', `/api/v1/comments/${commentId}`, {
      token: tokenFor(owner),
    });
    expect(res.statusCode).toBe(204);

    const row = await app.prisma.$queryRaw<{ deleted_at: Date | null }[]>`
      SELECT deleted_at FROM comments WHERE id = ${commentId}::uuid
    `;
    expect(row[0]?.deleted_at).not.toBeNull();
  });
});
