import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Hash password (admin123)
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create/Update Admin user
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            password: hashedPassword,
            name: 'Quản trị viên',
            role: 'ADMIN',
        },
        create: {
            username: 'admin',
            password: hashedPassword,
            name: 'Quản trị viên',
            role: 'ADMIN',
        },
    });

    console.log('✅ Admin user created/updated:', admin.username);

    // Create Sample Categories (TOEIC Standard)
    console.log('📦 Creating professional TOEIC categories...');
    const categories = [
        'Part 1: Photographs',
        'Part 2: Question-Response',
        'Part 3: Conversations',
        'Part 4: Talks',
        'Part 5: Incomplete Sentences',
        'Part 6: Text Completion',
        'Part 7: Reading Comprehension',
        'Vocabulary',
        'Grammar'
    ];
    for (const name of categories) {
        await prisma.category.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    console.log('✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
