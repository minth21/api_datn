import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { errorResponse, successResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * Recommendation Controller - Thuật toán AI gợi ý bài tập cá nhân hóa
 */
export class RecommendationController {
    /**
     * Gợi ý bài tập hàng ngày cho học viên
     * GET /api/recommendations/daily
     */
    async getDailyRecommendations(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;

            // 1. Lấy thông tin User & Target
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { targetScore: true, estimatedScore: true }
            });

            if (!user) return errorResponse(res, 'Không tìm thấy người dùng');
            const target = user.targetScore || 500;

            // 2. PHÂN TÍCH ĐIỂM YẾU SÂU (TOPIC-BASED)
            // Lấy 10 bài làm gần nhất để tìm các câu sai
            const recentAttempts = await prisma.testAttempt.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    details: {
                        where: { isCorrect: false },
                        include: { question: { select: { topic_tag: true } } }
                    }
                }
            });

            const topicWeights: { [key: string]: number } = {};
            recentAttempts.forEach(attempt => {
                attempt.details.forEach(detail => {
                    const tag = detail.question.topic_tag;
                    if (tag) {
                        topicWeights[tag] = (topicWeights[tag] || 0) + 1;
                    }
                });
            });

            // Lấy top 3 topic yếu nhất
            const topWeakTopics = Object.entries(topicWeights)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(t => t[0]);

            // 3. XÁC ĐỊNH LỘ TRÌNH THEO PART
            let baseParts: number[] = [];
            if (target <= 450) baseParts = [1, 2, 5];
            else if (target <= 750) baseParts = [3, 4, 6];
            else baseParts = [7];

            // 4. TRUY VẤN DỮ LIỆU GỢI Ý (POOL)
            // Lấy các Part chứa topic yếu
            const weaknessPool = await prisma.part.findMany({
                where: {
                    status: 'ACTIVE',
                    OR: [
                        { partNumber: { in: baseParts } },
                        { questions: { some: { topic_tag: { in: topWeakTopics } } } }
                    ]
                },
                include: { test: true },
                take: 30
            });

            // Lấy các Part ngẫu nhiên (Exploration - 20%)
            const discoveryPool = await prisma.part.findMany({
                where: {
                    status: 'ACTIVE',
                    NOT: { id: { in: weaknessPool.map(p => p.id) } }
                },
                include: { test: true },
                take: 10
            });

            // 5. ÁP DỤNG QUY TẮC 80/20 & SHUFFLE
            // Target: Gợi ý 5-7 mục
            const exploitationCount = Math.floor(6 * 0.8); // ~5 câu từ pool yếu
            const explorationCount = 2; // 2 câu từ pool mới

            const exploitationItems = weaknessPool.sort(() => 0.5 - Math.random()).slice(0, exploitationCount);
            const explorationItems = discoveryPool.sort(() => 0.5 - Math.random()).slice(0, explorationCount);

            const finalPool = [...exploitationItems, ...explorationItems].sort(() => 0.5 - Math.random());

            // 6. FORMAT & RETURN
            const recommendations = finalPool.map(p => ({
                id: p.id,
                title: `${p.partName}`,
                testTitle: p.test.title,
                partNumber: p.partNumber,
                difficulty: p.test.difficulty,
                totalQuestions: p.totalQuestions,
                reason: topWeakTopics.some(() => exploitationItems.some(ei => ei.id === p.id)) 
                        ? "AI phát hiện bạn cần cải thiện chủ đề này" 
                        : "Khám phá bài học mới hôm nay",
                type: 'PRACTICE'
            }));

            return successResponse(res, recommendations, 'Gợi ý bài tập AI (YouTube-style) thành công');
        } catch (error) {
            logger.error('Recommendation Engine Error:', error);
            return errorResponse(res, 'Lỗi khi xử lý dữ liệu gợi ý');
        }
    }
}

export const recommendationController = new RecommendationController();
