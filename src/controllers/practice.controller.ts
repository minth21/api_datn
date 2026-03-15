import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { evaluateProgress } from '../services/ai.service';
import { calculateEstimatedScore } from '../services/user.service';
import { calculateTOEICReadingScore } from '../utils/score.utils';

const prisma = new PrismaClient();

interface SubmitPartRequest {
    userId: string;
    partId: string;
    answers: {
        questionId: string;
        selectedOption: string;
    }[];
    timeTaken?: number; // Seconds
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
        const { userId, partId, answers, timeTaken }: SubmitPartRequest = req.body;

        if (!userId || !partId || !answers) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }

        // 1. Fetch Question Correct Answers AND Topic Tags
        const questionsSource = await prisma.question.findMany({
            where: { partId },
            select: {
                id: true,
                correctAnswer: true,
                topic_tag: true,
                questionText: true,
                explanation: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true
            } as any
        });

        const questions = questionsSource as unknown as {
            id: string,
            correctAnswer: string,
            topic_tag?: string,
            questionText?: string,
            explanation?: string,
            optionA?: string,
            optionB?: string,
            optionC?: string,
            optionD?: string
        }[];

        if (questions.length === 0) {
            res.status(404).json({ success: false, message: 'Part definition not found or empty' });
            return;
        }

        // 2. Calculate Score & Collect Details on Mistakes
        let correctCount = 0;
        const totalQuestions = questions.length;
        const answerMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));
        const incorrectTags: string[] = [];
        const errorDetails: any[] = [];

        questions.forEach(q => {
            const selected = answerMap.get(q.id);
            if (selected === q.correctAnswer) {
                correctCount++;
            } else {
                // Wrong answer, collect tag and details for AI
                if (q.topic_tag) {
                    incorrectTags.push(q.topic_tag);
                }
                errorDetails.push({
                    questionText: q.questionText,
                    selectedOption: selected || 'Không chọn',
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    options: {
                        A: q.optionA,
                        B: q.optionB,
                        C: q.optionC,
                        D: q.optionD
                    }
                });
            }
        });

        // 3. Fetch History
        const history = await prisma.userPartProgress.findMany({
            where: { userId, partId },
            orderBy: { createdAt: 'desc' }
        });

        const attemptNumber = history.length + 1;
        const percentage = parseFloat(((correctCount / totalQuestions) * 100).toFixed(1));

        // 4. Call AI for Evaluation


        const toeicScore = calculateTOEICReadingScore(correctCount, totalQuestions);
        // Recalculate percentage to match TOEIC score (User request for consistency)
        // 210/495 approx 42.4% -> 42%
        // const scoreBasedPercentage = parseFloat(((toeicScore / 495) * 100).toFixed(0));

        // 4. Save to DB immediately (score only)
        const savedProgress = await prisma.userPartProgress.create({
            data: {
                userId,
                partId,
                attemptNumber,
                score: correctCount,
                totalQuestions,
                percentage: percentage, // Use raw percentage (User request: No scaled scores)
                userAnswers: JSON.stringify(answers), // Save raw answers for review mode
                aiAssessment: null, // AI will update this later
                aiProgressScore: percentage, // Default to raw percentage initially
                toeicScore: toeicScore
            }
        });

        // 5. Update User Aggregate Progress
        await prisma.user.update({
            where: { id: userId },
            data: {
                updatedAt: new Date(),
                progress: Math.round(percentage) // Use rounded percentage for Int field
            }
        });

        // 6. RETURN TO CLIENT IMMEDIATELY (Fire & Forget)
        res.status(200).json({
            success: true,
            data: {
                id: savedProgress.id, // Return ID for polling
                score: correctCount,
                total: totalQuestions,
                percentage,
                aiAssessment: null, // Frontend will see this and show Shimmer
                aiProgressScore: percentage,
                attemptNumber
            }
        });

        // 7. BACKGROUND AI JOB (Do not await)
        (async () => {
            try {
                // Fetch User Name & Part Name for better AI personalization
                const [user, part] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: userId },
                        select: { name: true }
                    }),
                    prisma.part.findUnique({
                        where: { id: partId },
                        select: { partNumber: true }
                    })
                ]);

                const aiResult = await evaluateProgress(
                    correctCount,
                    totalQuestions,
                    timeTaken || 0,
                    user?.name || 'Học viên',
                    incorrectTags,
                    errorDetails,
                    `Part ${part?.partNumber || 5}`
                );

                // Update the record with AI result
                await prisma.userPartProgress.update({
                    where: { id: savedProgress.id },
                    data: {
                        aiAssessment: JSON.stringify(aiResult), // Store full JSON
                        aiProgressScore: aiResult.progressScore
                    }
                });

                // Update user progress with AI score if needed
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        progress: Math.round(aiResult.progressScore)
                    }
                });

                // Calculate and update Estimated TOEIC Score
                await calculateEstimatedScore(userId);

                console.log(`[AI Background] Assessment and Estimated Score updated for attempt ${savedProgress.id}`);
            } catch (err) {
                console.error("[AI Background] Failed evaluation or update:", err);
            }
        })();

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

/**
 * Get specific attempt detail
 * GET /api/practice/attempt/:id
 */
export const getAttemptDetail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const attempt = await prisma.userPartProgress.findUnique({
            where: { id }
        });

        if (!attempt) {
            res.status(404).json({ success: false, message: 'Attempt not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: attempt
        });
    } catch (error) {
        next(error);
    }
};
