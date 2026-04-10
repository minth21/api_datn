import { PrismaClient } from '@prisma/client';
import { calculateEstimatedScore } from '../services/user.service';

const prisma = new PrismaClient();

async function migrate() {
    console.log('--- STARTING SCORE MIGRATION (Cumulative Raw Logic) ---');
    
    try {
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' as any },
            select: { id: true, name: true }
        });

        console.log(`Found ${students.length} students to migrate.`);

        for (const student of students) {
            process.stdout.write(`Migrating [${student.name}] (${student.id})... `);
            try {
                const result = await calculateEstimatedScore(student.id);
                if (result) {
                    console.log(`DONE: ${result.totalEstimated}/990 (L:${result.estimatedL}, R:${result.estimatedR})`);
                } else {
                    console.log('SKIPPED (No data)');
                }
            } catch (err) {
                console.error(`FAILED for ${student.id}:`, err);
            }
        }

        console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
    } catch (error) {
        console.error('CRITICAL MIGRATION ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
