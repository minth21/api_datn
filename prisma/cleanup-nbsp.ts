import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Database Cleanup: Replacing &nbsp; with standard spaces...');

  try {
    // 1. Clean Parts table (instructions)
    const partResult = await prisma.$executeRaw`
      UPDATE parts 
      SET instructions = REPLACE(instructions, '&nbsp;', ' ')
      WHERE instructions LIKE '%&nbsp;%';
    `;
    console.log(`✅ Cleaned instructions in ${partResult} parts.`);

    // 2. Clean Questions table (passage)
    const passageResult = await prisma.$executeRaw`
      UPDATE questions 
      SET passage = REPLACE(passage, '&nbsp;', ' ')
      WHERE passage LIKE '%&nbsp;%';
    `;
    console.log(`✅ Cleaned passage in ${passageResult} questions.`);

    // 3. Clean Questions table (explanation, analysis, evidence)
    const detailResult = await prisma.$executeRaw`
      UPDATE questions 
      SET 
        explanation = REPLACE(explanation, '&nbsp;', ' '),
        analysis = REPLACE(analysis, '&nbsp;', ' '),
        evidence = REPLACE(evidence, '&nbsp;', ' ')
      WHERE 
        explanation LIKE '%&nbsp;%' OR 
        analysis LIKE '%&nbsp;%' OR 
        evidence LIKE '%&nbsp;%';
    `;
    console.log(`✅ Cleaned explanation/analysis/evidence in ${detailResult} questions.`);

    console.log('🎉 Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
