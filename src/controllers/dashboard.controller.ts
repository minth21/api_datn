import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get dashboard statistics
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const [userCount, testCount, questionCount] = await Promise.all([
            // Chỉ đếm người dùng có role là STUDENT - loại trừ ban quản trị
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.test.count(),
            prisma.question.count(),
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount,        // Số học viên (STUDENT only)
                tests: testCount,
                questions: questionCount,
            },
        });
    } catch (error) {
        next(error);
    }
};
