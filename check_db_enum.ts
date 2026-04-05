import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'Difficulty';
    `;
    console.log('Database Difficulty Enum Values:', result);
  } catch (e) {
    console.error('Error querying DB enum:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
