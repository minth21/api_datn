import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const p = prisma as any;

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
        const [userCount, testCount, classCount, questionCount, averageScoreResult, totalSubmissions, topStudents, recentSubmissions] = await Promise.all([
            // Chỉ đếm người dùng có role là STUDENT - loại trừ ban quản trị
            p.user.count({ where: { role: 'STUDENT' } }),
            p.test.count(),
            p.class.count(),
            p.question.count(),
            // Điểm trung bình của sinh viên (chỉ tính những người đã có điểm > 0)
            p.user.aggregate({
                _avg: { estimatedScore: true },
                where: { role: 'STUDENT', estimatedScore: { gt: 0 } }
            }),
            // Tổng số lượt làm bài
            p.userPartProgress.count(),
            // Top 5 học viên có điểm cao nhất
            p.user.findMany({
                where: { role: 'STUDENT' },
                orderBy: { estimatedScore: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatarUrl: true,
                    estimatedScore: true,
                    estimatedListening: true,
                    estimatedReading: true,
                }
            }),
            // 10 lượt làm bài gần nhất của hệ thống
            p.userPartProgress.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    user: {
                        select: { name: true, avatarUrl: true }
                    },
                    part: {
                        select: { partName: true, test: { select: { title: true } } }
                    }
                }
            })
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount || 0,
                tests: testCount || 0,
                classes: classCount || 0,
                questions: questionCount || 0,
                averageScore: Math.round(averageScoreResult?._avg?.estimatedScore || 0),
                totalSubmissions: totalSubmissions || 0,
                topStudents: topStudents || [],
                recentSubmissions: recentSubmissions || [],
            },
        });
    } catch (error) {
        next(error);
    }
};
