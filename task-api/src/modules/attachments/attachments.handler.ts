import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  uploadAttachment,
  listAttachments,
  getAttachmentForDownload,
  deleteAttachment,
} from './attachments.service.js';
import type { ActivityEmitter } from '../activity/activity.emitter.js';

type TaskParams = { id: string };
type AttachmentParams = { id: string };

function getEmitter(req: FastifyRequest): ActivityEmitter | undefined {
  return (req as FastifyRequest & { activityEmitter?: ActivityEmitter }).activityEmitter;
}

export async function uploadAttachmentHandler(
  req: FastifyRequest<{ Params: TaskParams }>,
  reply: FastifyReply,
) {
  const data = await req.file();
  if (!data) {
    return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file provided' });
  }

  const attachment = await uploadAttachment(req.server.prisma, req.params.id, req.user!.id, data);

  getEmitter(req)?.enqueue({
    projectId: attachment.task.projectId,
    taskId: req.params.id,
    actorId: req.user!.id,
    action: 'ATTACHMENT_ADDED',
    metadata: { attachmentId: attachment.id, filename: attachment.filename },
  });

  return reply.status(201).send({ attachment });
}

export async function listAttachmentsHandler(
  req: FastifyRequest<{ Params: TaskParams }>,
  reply: FastifyReply,
) {
  const attachments = await listAttachments(req.server.prisma, req.params.id);
  return reply.send({ attachments });
}

export async function downloadAttachmentHandler(
  req: FastifyRequest<{ Params: AttachmentParams }>,
  reply: FastifyReply,
) {
  const { attachment, stream } = await getAttachmentForDownload(
    req.server.prisma,
    req.params.id,
    req.user!.id,
  );

  return reply
    .header('Content-Type', attachment.mimeType)
    .header('Content-Disposition', `attachment; filename="${attachment.filename}"`)
    .header('Content-Length', attachment.size)
    .send(stream);
}

export async function deleteAttachmentHandler(
  req: FastifyRequest<{ Params: AttachmentParams }>,
  reply: FastifyReply,
) {
  const { projectId, taskId } = await deleteAttachment(
    req.server.prisma,
    req.params.id,
    req.user!.id,
  );

  getEmitter(req)?.enqueue({
    projectId,
    taskId,
    actorId: req.user!.id,
    action: 'ATTACHMENT_REMOVED',
    metadata: { attachmentId: req.params.id },
  });

  return reply.status(204).send();
}
