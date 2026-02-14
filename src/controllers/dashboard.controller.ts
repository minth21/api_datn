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
            prisma.user.count(),
            prisma.test.count(),
            prisma.question.count(),
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount,
                tests: testCount,
                questions: questionCount,
            },
        });
    } catch (error) {
        next(error);
    }
};
