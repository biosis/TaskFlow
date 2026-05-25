import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  if (process.env['NODE_ENV'] === 'production') return;

  const userId = uuidv7();
  const projectId = uuidv7();

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      id: userId,
      email: 'demo@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      displayName: 'Demo User',
    },
  });

  const project = await prisma.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      name: 'Demo Project',
      description: 'A demo project for testing',
      ownerId: user.id,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });

  await prisma.task.create({
    data: {
      id: uuidv7(),
      projectId: project.id,
      createdById: user.id,
      title: 'First task',
      description: 'This is the first task in the demo project',
    },
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
