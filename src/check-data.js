const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const userCount = await prisma.user.count();
        const testCount = await prisma.test.count();
        const questionCount = await prisma.question.count();
        console.log('--- DATABASE STATUS ---');
        console.log(`User Count: ${userCount}`);
        console.log(`Test Count: ${testCount}`);
        console.log(`Question Count: ${questionCount}`);
        console.log('------------------------');
    } catch (error) {
        console.error('Error checking DB:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
