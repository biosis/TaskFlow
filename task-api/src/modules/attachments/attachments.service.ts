import { createWriteStream, createReadStream } from 'node:fs';
import { unlink, mkdir, stat, rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileTypeFromFile } from 'file-type';
import type { PrismaClient } from '@prisma/client';
import type { MultipartFile } from '@fastify/multipart';
import { config } from '../../config.js';
import { newId } from '../../utils/id.js';
import {
  FileTooLargeError,
  InvalidFileTypeError,
  AttachmentNotFoundError,
  ForbiddenError,
} from '../../utils/errors.js';
import { getMemberRole } from '../projects/projects.members.service.js';
import {
  ALLOWED_MIME_TYPES,
  TEXT_MIME_TYPES,
  getExtension,
  sanitizeFilename,
} from './attachments.schema.js';

async function getUploadDir(): Promise<string> {
  const dir = path.resolve(config.UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function uploadAttachment(
  prisma: PrismaClient,
  taskId: string,
  uploadedById: string,
  data: MultipartFile,
) {
  const uploadDir = await getUploadDir();
  const tmpPath = path.join(uploadDir, `tmp_${randomUUID()}`);

  try {
    await pipeline(data.file, createWriteStream(tmpPath));

    if (data.file.truncated) {
      throw new FileTooLargeError(config.UPLOAD_MAX_SIZE_MB);
    }

    const { size } = await stat(tmpPath);
    if (size === 0) throw new InvalidFileTypeError();

    // Detect actual file type from magic bytes
    const detected = await fileTypeFromFile(tmpPath);
    let resolvedMime: string;

    if (detected) {
      if (!ALLOWED_MIME_TYPES.has(detected.mime)) throw new InvalidFileTypeError();
      resolvedMime = detected.mime;
    } else {
      // No detectable magic bytes — only plain text/csv allowed, validated by declared MIME
      const declared = (data.mimetype ?? '').toLowerCase();
      if (!TEXT_MIME_TYPES.has(declared)) throw new InvalidFileTypeError();
      resolvedMime = declared;
    }

    const storedName = `${randomUUID()}${getExtension(resolvedMime)}`;
    const finalPath = path.join(uploadDir, storedName);
    await rename(tmpPath, finalPath);

    return prisma.taskAttachment.create({
      data: {
        id: newId(),
        taskId,
        uploadedById,
        filename: sanitizeFilename(data.filename ?? 'file'),
        storedName,
        mimeType: resolvedMime,
        size,
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        task: { select: { projectId: true } },
      },
    });
  } catch (err) {
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

export async function listAttachments(prisma: PrismaClient, taskId: string) {
  return prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    include: {
      uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });
}

export async function getAttachmentForDownload(
  prisma: PrismaClient,
  attachmentId: string,
  userId: string,
) {
  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    include: { task: { select: { projectId: true } } },
  });
  if (!attachment) throw new AttachmentNotFoundError();

  const role = await getMemberRole(prisma, userId, attachment.task.projectId);
  if (!role) throw new AttachmentNotFoundError();

  const uploadDir = path.resolve(config.UPLOAD_DIR);
  const filePath = path.join(uploadDir, attachment.storedName);

  // Guard against path traversal (storedName is UUID-generated but validate anyway)
  if (!filePath.startsWith(uploadDir + path.sep)) throw new AttachmentNotFoundError();

  return { attachment, stream: createReadStream(filePath) };
}

export async function deleteAttachment(
  prisma: PrismaClient,
  attachmentId: string,
  userId: string,
) {
  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    include: { task: { select: { projectId: true } } },
  });
  if (!attachment) throw new AttachmentNotFoundError();

  const role = await getMemberRole(prisma, userId, attachment.task.projectId);
  const isUploader = attachment.uploadedById === userId;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  if (!isUploader && !isAdmin) throw new ForbiddenError();

  const uploadDir = path.resolve(config.UPLOAD_DIR);
  const filePath = path.join(uploadDir, attachment.storedName);

  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  await unlink(filePath).catch(() => {});

  return { projectId: attachment.task.projectId, taskId: attachment.taskId };
}
