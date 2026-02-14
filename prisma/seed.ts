import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Hash password (6 characters minimum)
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create/Update Admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {
            password: hashedPassword,
        },
        create: {
            email: 'admin@gmail.com',
            password: hashedPassword,
            name: 'Quản trị viên',
            role: 'ADMIN',
        },
    });

    console.log('✅ Admin user created/updated:', admin);
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: admin123');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
