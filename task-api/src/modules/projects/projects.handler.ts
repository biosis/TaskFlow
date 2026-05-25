import type { FastifyRequest, FastifyReply } from 'fastify';
import * as projectsService from './projects.service.js';
import * as membersService from './projects.members.service.js';
import type {
  CreateProjectBody,
  UpdateProjectBody,
  AddMemberBody,
  UpdateMemberBody,
  ListProjectsQuery,
} from './projects.schema.js';

export async function createProjectHandler(
  request: FastifyRequest<{ Body: CreateProjectBody }>,
  reply: FastifyReply,
) {
  const project = await projectsService.createProject(
    request.server.prisma,
    request.user!.id,
    request.body,
  );
  return reply.status(201).send({ project });
}

export async function listProjectsHandler(
  request: FastifyRequest<{ Querystring: ListProjectsQuery }>,
  reply: FastifyReply,
) {
  const result = await projectsService.listProjects(
    request.server.prisma,
    request.user!.id,
    request.query,
  );
  return reply.send(result);
}

export async function getProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const project = await projectsService.getProject(request.server.prisma, request.params.id);
  return reply.send({ project });
}

export async function updateProjectHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateProjectBody }>,
  reply: FastifyReply,
) {
  const project = await projectsService.updateProject(
    request.server.prisma,
    request.params.id,
    request.body,
  );
  return reply.send({ project });
}

export async function deleteProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await projectsService.deleteProject(request.server.prisma, request.params.id);
  return reply.status(204).send();
}

export async function restoreProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const project = await projectsService.restoreProject(request.server.prisma, request.params.id);
  return reply.send({ project });
}

export async function archiveProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const project = await projectsService.archiveProject(request.server.prisma, request.params.id);
  return reply.send({ project });
}

export async function unarchiveProjectHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const project = await projectsService.unarchiveProject(request.server.prisma, request.params.id);
  return reply.send({ project });
}

export async function listMembersHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const members = await membersService.listMembers(request.server.prisma, request.params.id);
  return reply.send({ members });
}

export async function addMemberHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: AddMemberBody }>,
  reply: FastifyReply,
) {
  const member = await membersService.addMember(
    request.server.prisma,
    request.params.id,
    request.body.email,
    request.body.role,
    request.user!.id,
  );
  return reply.status(201).send({ member });
}

export async function updateMemberHandler(
  request: FastifyRequest<{ Params: { id: string; userId: string }; Body: UpdateMemberBody }>,
  reply: FastifyReply,
) {
  const member = await membersService.updateMember(
    request.server.prisma,
    request.params.id,
    request.params.userId,
    request.body.role,
  );
  return reply.send({ member });
}

export async function removeMemberHandler(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply,
) {
  await membersService.removeMember(
    request.server.prisma,
    request.params.id,
    request.params.userId,
  );
  return reply.status(204).send();
}

export async function getProjectStatsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const stats = await projectsService.getProjectStats(request.server.prisma, request.params.id);
  return reply.send(stats);
}
