import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { evaluateProgress } from '../services/ai.service';

const prisma = new PrismaClient();

interface SubmitPartRequest {
    userId: string;
    partId: string;
    answers: {
        questionId: string;
        selectedOption: string;
    }[];
}

/**
 * Submit answers for a part
 * POST /api/practice/submit
 */
export const submitPart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId, partId, answers }: SubmitPartRequest = req.body;

        if (!userId || !partId || !answers) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }

        // 1. Fetch Question Correct Answers
        const questions = await prisma.question.findMany({
            where: { partId },
            select: { id: true, correctAnswer: true }
        });

        if (questions.length === 0) {
            res.status(404).json({ success: false, message: 'Part definition not found or empty' });
            return;
        }

        // 2. Calculate Score
        let correctCount = 0;
        const totalQuestions = questions.length;
        const answerMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));

        questions.forEach(q => {
            if (answerMap.get(q.id) === q.correctAnswer) {
                correctCount++;
            }
        });

        // 3. Fetch History (for AI context & attempt counting)
        const history = await prisma.userPartProgress.findMany({
            where: { userId, partId },
            orderBy: { attemptNumber: 'asc' }
        });

        const attemptNumber = history.length + 1;
        const percentage = parseFloat(((correctCount / totalQuestions) * 100).toFixed(1));

        // 4. Call AI for Evaluation
        // Convert Prisma objects to interface expected by service if needed, or just map manually
        const historyForAI = history.map(h => ({
            attemptNumber: h.attemptNumber,
            score: h.score,
            totalQuestions: h.totalQuestions,
            percentage: h.percentage,
            date: h.createdAt
        }));

        const aiResult = await evaluateProgress(correctCount, totalQuestions, historyForAI);

        // 5. Save to DB
        const progress = await prisma.userPartProgress.create({
            data: {
                userId,
                partId,
                attemptNumber,
                score: correctCount,
                totalQuestions,
                percentage,
                aiAssessment: aiResult.assessment,
                aiProgressScore: aiResult.progressScore
            }
        });

        // 6. Update User Aggregate Progress
        await prisma.user.update({
            where: { id: userId },
            data: {
                updatedAt: new Date(),
                progress: Math.round(aiResult.progressScore) // Update progress with latest AI score
            }
        });

        res.status(200).json({
            success: true,
            data: {
                score: correctCount,
                total: totalQuestions,
                percentage,
                aiAssessment: aiResult.assessment,
                aiProgressScore: aiResult.progressScore,
                attemptNumber
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get history for a part
 * GET /api/practice/history/:userId/:partId
 */
export const getPartHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId, partId } = req.params;

        const history = await prisma.userPartProgress.findMany({
            where: { userId, partId },
            orderBy: { attemptNumber: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};
