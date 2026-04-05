import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    // Find a valid partId first
    const part = await prisma.part.findFirst();
    if (!part) {
      console.log('No part found to test with.');
      return;
    }

    const testQuestion = {
      partId: part.id,
      questionNumber: 9999, // Unique enough
      questionText: 'Test question text',
      optionA: 'Option A',
      optionB: 'Option B',
      optionC: 'Option C',
      optionD: 'Option D',
      correctAnswer: 'A',
      explanation: 'Test explanation',
      level: 'B1_B2', // THE TROUBLEMAKER
      status: 'PENDING'
    };

    console.log('Attempting to insert question with level: B1_B2');
    const result = await (prisma.question as any).create({
      data: testQuestion
    });
    console.log('Success! Result:', result);

    // Clean up
    await (prisma.question as any).delete({ where: { id: result.id } });
    console.log('Cleaned up the test question.');

  } catch (e) {
    console.error('FAILED to insert question:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
