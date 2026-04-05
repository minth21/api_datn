import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get student dashboard data
 * GET /api/dashboard/student
 */
export const getStudentDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        // 1. Get User Data with streak fields
        const user = (await (prisma as any).user.findUnique({
            where: { id: userId },
            select: {
                name: true,
                progress: true,
                targetScore: true,
                estimatedScore: true,
                estimatedListening: true,
                estimatedReading: true,
                currentStreak: true,
                lastActiveAt: true,
                highestScore: true,
                averageScore: true,
                totalAttempts: true,
            } as any,
        })) as any;

        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // 2. Persistent Streak Logic
        let updatedStreak = user.currentStreak || 0;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (!user.lastActiveAt) {
            // First time activity
            updatedStreak = 1;
            await prisma.user.update({
                where: { id: userId },
                data: { currentStreak: 1, lastActiveAt: now } as any,
            });
        } else {
            const lastActive = new Date(user.lastActiveAt);
            const lastActiveDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
            
            const diffTime = today.getTime() - lastActiveDay.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Practiced exactly the day after -> Increment streak
                updatedStreak += 1;
                await prisma.user.update({
                    where: { id: userId },
                    data: { currentStreak: updatedStreak, lastActiveAt: now } as any,
                });
            } else if (diffDays > 1) {
                // Broke streak -> Reset to 1
                updatedStreak = 1;
                await prisma.user.update({
                    where: { id: userId },
                    data: { currentStreak: 1, lastActiveAt: now } as any,
                });
            } else if (diffDays === 0) {
                // Already active today -> Keep current streak, just update timestamp
                await prisma.user.update({
                    where: { id: userId },
                    data: { lastActiveAt: now } as any,
                });
            }
        }

        // 3. Recent Activities (Last 3 persistence attempts from TestAttempt)
        const recentActivities = await prisma.testAttempt.findMany({
            where: { userId },
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: {
                part: {
                    select: {
                        partNumber: true,
                        partName: true,
                        test: {
                            select: {
                                title: true,
                            }
                        }
                    }
                },
                test: {
                    select: {
                        title: true,
                    }
                }
            }
        });

        // 4. AI Recommendations (Keep existing logic but refine)
        const latestWeakAttempt = await prisma.userPartProgress.findFirst({
            where: { 
                userId,
                percentage: { lt: 0.7 }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                part: {
                    select: { partName: true }
                }
            }
        });

        const recommendations = [];
        if (latestWeakAttempt) {
            recommendations.push({
                title: `Ôn lại ${latestWeakAttempt.part.partName}`,
                subtitle: `Bạn đạt ${Math.round(latestWeakAttempt.percentage * 100)}% ở lần làm gần nhất.`,
                type: 'REVIEW',
                icon: 'warning',
            });
        }

        if (recommendations.length < 2) {
            recommendations.push({
                title: 'Luyện tập kỹ năng yếu nhất',
                subtitle: 'Gia sư AI khuyên bạn nên tập trung vào Listening Part 1.',
                type: 'SUGGESTION',
                icon: 'psychology',
            });
        }

        // 6. Activity Stats (Frequency Chart - Last 7 days)
        const activityStats = [];
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);

            const count = await prisma.testAttempt.count({
                where: {
                    userId,
                    createdAt: {
                        gte: date,
                        lt: nextDate,
                    }
                }
            });

            activityStats.push({
                label: dayLabels[date.getDay()],
                count
            });
        }
        // 7. Resume Learning (Last activity)
        const resumeLearning = recentActivities.length > 0 ? {
            id: recentActivities[0].id,
            partId: recentActivities[0].partId,
            partNumber: recentActivities[0].part?.partNumber ?? 0,
            title: recentActivities[0].test?.title ?? recentActivities[0].part?.test?.title ?? 'Luyện tập',
            createdAt: recentActivities[0].createdAt,
        } : null;

        res.status(200).json({
            success: true,
            data: {
                user: {
                    name: user.name,
                    progress: user.progress || 0,
                    targetScore: user.targetScore || 800,
                    estimatedScore: user.highestScore ?? user.estimatedScore ?? 0,
                    estimatedListening: user.estimatedListening ?? 0,
                    estimatedReading: user.estimatedReading ?? 0,
                    highestScore: user.highestScore ?? 0,
                    averageScore: user.averageScore ?? 0,
                    totalAttempts: user.totalAttempts ?? 0,
                },
                streak: updatedStreak,
                recentActivities: recentActivities.map(a => ({
                    id: a.id,
                    partId: a.partId,
                    partNumber: a.part?.partNumber ?? 0,
                    title: a.test?.title ?? a.part?.test?.title ?? 'Luyện tập',
                    partName: a.part?.partName ?? 'Tổng hợp',
                    score: a.correctCount,
                    totalQuestions: a.totalQuestions,
                    percentage: a.totalQuestions ? Math.round((a.correctCount! / a.totalQuestions!) * 100) : 0,
                    toeicScore: a.totalScore,
                    createdAt: a.createdAt,
                })),
                recommendations,
                resumeLearning,
                activityStats,
            },
        });
    } catch (error) {
        next(error);
    }
};
