import type { PrismaClient, ActivityAction } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { newId } from '../../utils/id.js';
import { logger } from '../../utils/logger.js';

export interface ActivityEvent {
  projectId: string;
  taskId?: string;
  actorId: string;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
}

export class ActivityEmitter {
  private queue: ActivityEvent[] = [];

  enqueue(event: ActivityEvent): void {
    this.queue.push(event);
  }

  async flush(prisma: PrismaClient): Promise<void> {
    if (this.queue.length === 0) return;
    const events = [...this.queue];
    try {
      await prisma.activity.createMany({
        data: events.map((e) => ({
          id: newId(),
          projectId: e.projectId,
          taskId: e.taskId,
          actorId: e.actorId,
          action: e.action,
          metadata: (e.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      });
      this.queue.splice(0, events.length);
    } catch (err) {
      logger.error({ err }, 'Failed to flush activity events');
    }
  }
}
