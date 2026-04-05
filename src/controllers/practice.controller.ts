import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { evaluateProgress } from '../services/ai.service';
import { calculateEstimatedScore } from '../services/user.service';
import { calculateScaledScore } from '../utils/score.util';
import { NotificationService } from '../services/notification.service';

const prisma = new PrismaClient() as any;

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

        // 1. Fetch Part & Question Correct Answers AND Topic Tags
        const [part, questionsSource] = await Promise.all([
            prisma.part.findUnique({
                where: { id: partId },
                select: { partNumber: true, partName: true }
            }),
            (prisma.question as any).findMany({
                where: {
                    partId,
                    // [FIX] Include PENDING questions too — Part 1/2/3/4 questions may not be ACTIVE
                    // Only exclude explicitly LOCKED questions
                    status: { not: 'LOCKED' }
                },
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
                }
            })
        ]);

        if (!part) {
            res.status(404).json({ success: false, message: 'Part not found' });
            return;
        }

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
                // [FIX] Part 1 has no questionText — use placeholder so AI prompt is not broken
                errorDetails.push({
                    questionText: q.questionText || '(Câu hỏi nghe - không có văn bản)',
                    selectedOption: selected || 'Không chọn',
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    options: {
                        A: q.optionA || 'A',
                        B: q.optionB || 'B',
                        C: q.optionC || 'C',
                        D: q.optionD || 'D'
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


        const skillType = part.partNumber <= 4 ? 'LISTENING' : 'READING';
        const toeicScore = calculateScaledScore(correctCount, totalQuestions, skillType);
        // Recalculate percentage to match TOEIC score (User request for consistency)
        // 210/495 approx 42.4% -> 42%
        // const scoreBasedPercentage = parseFloat(((toeicScore / 495) * 100).toFixed(0));

        // 4. Save to DB (Legacy and New structure) + Update Analytics
        const savedProgress = await (prisma as any).$transaction(async (tx: any) => {
            // Get current user stats for comparison
            const currentUser = await tx.user.findUnique({
                where: { id: userId },
                select: { highestScore: true, studentClassId: true, totalAttempts: true, averageScore: true }
            });

            // A. Save to Legacy Board (UserPartProgress)
            const progress = await tx.userPartProgress.create({
                data: {
                    userId,
                    partId,
                    attemptNumber,
                    score: correctCount,
                    totalQuestions,
                    percentage: percentage,
                    userAnswers: JSON.stringify(answers),
                    aiAssessment: null,
                    aiProgressScore: percentage,
                    toeicScore: toeicScore
                }
            });

            // B. Save to NEW Board (TestAttempt)
            const attempt = await tx.testAttempt.create({
                data: {
                    userId,
                    partId,
                    startTime: new Date(Date.now() - (timeTaken || 0) * 1000), // Approximate start time
                    endTime: new Date(),
                    durationSeconds: timeTaken || 0,
                    correctCount,
                    totalQuestions,
                    totalScore: toeicScore,
                    listeningScore: skillType === 'LISTENING' ? toeicScore : 0,
                    readingScore: skillType === 'READING' ? toeicScore : 0,
                }
            });

            // C. Save Details (AttemptDetail)
            const detailData = questions.map(q => {
                const selected = answerMap.get(q.id);
                return {
                    attemptId: attempt.id,
                    questionId: q.id,
                    userAnswer: selected || null,
                    isCorrect: selected === q.correctAnswer,
                };
            });

            await tx.attemptDetail.createMany({
                data: detailData
            });

            // D. Update User Aggregate Stats (Analytics)
            const newHighestScore = Math.max(currentUser?.highestScore || 0, toeicScore);
            const oldTotalAttempts = currentUser?.totalAttempts || 0;
            const oldAverage = currentUser?.averageScore || 0;
            const newAverage = Math.round((oldAverage * oldTotalAttempts + toeicScore) / (oldTotalAttempts + 1));
            
            await tx.user.update({
                where: { id: userId },
                data: {
                    updatedAt: new Date(),
                    lastActiveAt: new Date(),
                    progress: Math.round(percentage),
                    totalAttempts: { increment: 1 },
                    highestScore: newHighestScore,
                    averageScore: newAverage
                }
            });

            // E. Update Class Activity
            if (currentUser?.studentClassId) {
                await tx.class.update({
                    where: { id: currentUser.studentClassId },
                    data: { lastActivityAt: new Date() }
                });
            }

            return { progress, attempt };
        });

        // 7. ASYNC NOTIFICATION (Do not block response)
        (async () => {
            try {
                const student = await prisma.user.findUnique({
                    where: { id: userId },
                    include: { studentClass: true }
                });

                if (student?.studentClass?.teacherId) {
                    await NotificationService.createNotification({
                        userId: student.studentClass.teacherId, // Gửi cho giáo viên
                        title: 'Học viên nộp bài mới',
                        content: `${student.name} vừa hoàn thành ${part.partName} với số câu đúng là ${correctCount}/${totalQuestions} (Quy đổi: ${toeicScore}/495).`,
                        type: 'TEST_SUBMITTED' as any,
                        relatedId: savedProgress.attempt.id
                    });
                }
            } catch (error) {
                console.error('Failed to send notification:', error);
            }
        })();

        // 8. RETURN TO CLIENT
        res.status(200).json({
            success: true,
            data: {
                id: savedProgress.progress.id,
                attemptId: savedProgress.attempt.id, // New Attempt ID
                score: correctCount,
                total: totalQuestions,
                percentage,
                userAnswers: answers,
                aiAssessment: null,
                aiProgressScore: percentage,
                attemptNumber,
                toeicScore: toeicScore
            }
        });

        // 7. BACKGROUND JOBS (AI Assessment)
        (async () => {
            let finalAiResult: any = null;
            try {
                // Ensure we have correct counts
                const score = correctCount;
                const total = totalQuestions;

                // 1. Fetch User & Part Data for context
                const [user, partData] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: userId },
                        select: { name: true, targetScore: true }
                    }),
                    prisma.part.findUnique({
                        where: { id: partId },
                        select: { partNumber: true }
                    })
                ]).catch(() => [null, null]);

                // 2. Calculate Topic Matrix for Overall AI Insight
                const topicMatrix: Record<string, { correct: number, total: number }> = {};
                questions.forEach(q => {
                    const tag = q.topic_tag || 'Tổng quát';
                    if (!topicMatrix[tag]) topicMatrix[tag] = { correct: 0, total: 0 };
                    topicMatrix[tag].total++;
                    const selected = answerMap.get(q.id);
                    if (selected === q.correctAnswer) {
                        topicMatrix[tag].correct++;
                    }
                });

                finalAiResult = await evaluateProgress(
                    score,
                    total,
                    timeTaken || 0,
                    user?.name || 'Học viên',
                    JSON.stringify(topicMatrix), 
                    `Part ${partData?.partNumber || 5}`,
                    user?.targetScore || undefined
                );

                const aiResultJson = JSON.stringify(finalAiResult);

                // 1. Update TestAttempt (Main Record)
                await prisma.testAttempt.update({
                    where: { id: savedProgress.attempt.id },
                    data: { aiAnalysis: aiResultJson }
                }).catch((err: any) => console.error("[AI] Failed to update TestAttempt:", err));

                // 2. CREATE AI ASSESSMENT TIMELINE RECORD (For Web Dashboard/Teacher)
                // Consolidated logic to ensure one high-quality record per attempt
                await (prisma as any).aiAssessment.create({
                    data: {
                        userId: userId,
                        testAttemptId: savedProgress.attempt.id,
                        type: 'COACHING', // PERFORMANCE, COACHING, EXPLANATION
                        title: `Tư vấn chiến thuật ${partData?.partNumber ? `Part ${partData.partNumber}` : 'Bài tập'}`,
                        summary: finalAiResult.detailedAssessment || finalAiResult.shortFeedback || "AI đã đánh giá xong bài làm của bạn.",
                        content: finalAiResult, // Save full JSON for metrics
                        score: toeicScore,  // Store the actual score reached at this milestone (Corrected variable)
                        trend: 'STABLE', // Could be calculated comparing history
                        createdAt: new Date()
                    }
                }).catch((err: any) => console.error("[AI] Failed to create AiAssessment record:", err));

                // 3. Update UserPartProgress (Legacy support)
                await prisma.userPartProgress.update({
                    where: { id: savedProgress.progress.id },
                    data: {
                        aiAssessment: aiResultJson,
                        aiProgressScore: percentage
                    }
                }).catch((err: any) => console.error("[AI] Failed to update UserPartProgress:", err));

                // Secondary tasks - wrap in try/catch so they don't break the main flow
                try {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { progress: Math.round(finalAiResult.progressScore || percentage) }
                    });
                    
                    await calculateEstimatedScore(userId);
                    
                    // console.log("[AI] Consolidated assessment created above.");

                    // Smart Notification
                    if (user) {
                        const userData = await prisma.user.findUnique({ where: { id: userId }, select: { allowAiPushNotification: true } });
                        if (userData?.allowAiPushNotification) {
                            await NotificationService.createNotification({
                                userId,
                                title: '💡 AI Coach: Lời khuyên cho bạn',
                                content: `Kết quả ${score}/${total} cực kỳ ấn tượng! Hãy xem phân tích chi tiết nhé.`,
                                type: 'FEEDBACK_RESOLVED' as any,
                                relatedId: savedProgress.attempt.id
                            });
                        }
                    }
                } catch (secondaryErr) {
                    console.error("[AI Background] Secondary tasks failed:", secondaryErr);
                }

            } catch (err) {
                console.error("[AI Background] FATAL ERROR:", err);
                // FINAL FALLBACK: If everything failed, try to save at least SOMETHING
                try {
                    const fallback = {
                        progressScore: Math.round((correctCount / totalQuestions) * 100),
                        shortFeedback: "Hệ thống ghi nhận kết quả thành công.",
                        skills: { grammar: 5, vocabulary: 5, inference: 5, mainIdea: 5 },
                        strengths: ["Hoàn thành bài tập"],
                        weaknesses: ["Cần kiểm tra kỹ kết quả"],
                        vocabularyFlashcards: [],
                        detailedAssessment: "<p>Dữ liệu bài làm đã được lưu. AI đang gặp chút sự cố khi phân tích chi tiết, bạn hãy xem lại các câu sai trong tab 'Xem lại' nhé.</p>"
                    };
                    await prisma.testAttempt.update({
                        where: { id: savedProgress.attempt.id },
                        data: { aiAnalysis: JSON.stringify(fallback) }
                    });
                } catch (lastDitchErr) {
                    console.error("[AI Background] Last ditch effort failed:", lastDitchErr);
                }
            }
        })();

    } catch (error) {
        next(error);
    }
};

/**
 * Get history for a part (New Structure)
 * GET /api/practice/history/:userId/:partId
 */
export const getPartHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId, partId } = req.params;

        const history = await prisma.testAttempt.findMany({
            where: { userId, partId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                startTime: true,
                durationSeconds: true,
                totalScore: true,
                correctCount: true,
                totalQuestions: true,
                aiAnalysis: true,
                createdAt: true
            }
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
 * Get specific attempt detail with Question Data
 * GET /api/practice/attempt/:id
 */
export const getAttemptDetail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params; // TestAttempt ID

        const attempt = await prisma.testAttempt.findUnique({
            where: { id },
            include: {
                part: true,
                details: {
                    include: {
                        question: {
                            select: {
                                questionNumber: true,
                                questionText: true,
                                optionA: true,
                                optionB: true,
                                optionC: true,
                                optionD: true,
                                correctAnswer: true,
                                explanation: true,
                                evidence: true,
                                analysis: true,
                                questionTranslation: true,
                                optionTranslations: true,
                                imageUrl: true,
                                audioUrl: true,
                                passageTitle: true
                            }
                        }
                    },
                    orderBy: {
                        question: { questionNumber: 'asc' }
                    }
                }
            }
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

/**
 * Lấy lịch sử làm bài của người dùng
 */
export const getUserHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;
        const attempts = await prisma.testAttempt.findMany({
            where: { userId },
            include: {
                part: {
                    select: {
                        id: true,
                        partName: true,
                        partNumber: true,
                        totalQuestions: true,
                    }
                },
                test: {
                    select: {
                        id: true,
                        title: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            success: true,
            data: attempts
        });
    } catch (error) {
        next(error);
    }
};
