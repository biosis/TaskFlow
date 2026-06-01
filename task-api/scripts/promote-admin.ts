import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/promote-admin.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, displayName: true, role: true },
  });
  console.log(`Promoted to ADMIN:`, user);
} catch {
  console.error(`User not found: ${email}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
