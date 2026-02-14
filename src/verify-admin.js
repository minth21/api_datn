const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'admin@gmail.com' }
        });
        if (user) {
            console.log('--- ADMIN ACCOUNT FOUND ---');
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            console.log('---------------------------');
        } else {
            console.log('--- ADMIN ACCOUNT NOT FOUND ---');
        }
    } catch (error) {
        console.error('Error checking Admin:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
