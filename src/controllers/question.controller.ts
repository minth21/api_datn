import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { validateAndStandardizePassageData } from '../utils/passageValidator';

import { Difficulty } from '@prisma/client';
const prisma = new PrismaClient();

console.log('RUNTIME Difficulty Enum:', Object.values(Difficulty));

/**
 * Helper to sanitize and map Difficulty values
 */
const sanitizeDifficulty = (level: string | null | undefined): Difficulty | null => {
    if (!level) return null;
    
    const upperLevel = level.toUpperCase().trim();
    
    // Map common variants to enum values
    const mapping: Record<string, Difficulty> = {
        'A1': Difficulty.A1_A2,
        'A2': Difficulty.A1_A2,
        'A1_A2': Difficulty.A1_A2,
        'B1': Difficulty.B1_B2,
        'B2': Difficulty.B1_B2,
        'B1_B2': Difficulty.B1_B2,
        'B2_C1': Difficulty.B2_C1,
        'C1': Difficulty.C1,
        'C2': Difficulty.C2,
        'EASY': Difficulty.EASY,
        'MEDIUM': Difficulty.MEDIUM,
        'HARD': Difficulty.HARD
    };

    return mapping[upperLevel] || null;
};

/**
 * Get all questions by Part ID
 * GET /api/parts/:partId/questions
 */
export const getQuestionsByPartId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const { level, status } = req.query;
        const role = (req as any).user?.role;
        const isAdminOrSpecialist = role === 'ADMIN' || role === 'SPECIALIST';

        const where: any = { partId };
        
        // Filter by status (Admin/Specialist can see all, students only ACTIVE)
        if (isAdminOrSpecialist) {
            if (status && status !== 'ALL') {
                where.status = status;
            }
        } else {
            where.status = 'ACTIVE';
        }

        // Filter by level if provided
        if (level && level !== 'ALL') {
            where.level = level;
        }

        const questions = await (prisma.question as any).findMany({
            where,
            orderBy: {
                questionNumber: 'asc',
            },
        });

        res.status(200).json({
            success: true,
            questions,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a single question manually
 * POST /api/parts/:partId/questions
 */
export const createQuestion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const {
            questionNumber,
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            explanation,
            analysis, // ✅ New
            evidence, // ✅ New
            questionTranslation, // ✅ New
            optionTranslations, // ✅ New
            keyVocabulary, // ✅ New
            passageTitle, // ✅ New
            level, // ✅ New Mức độ khó
            audioUrl,
            imageUrl, // Add imageUrl
            transcript
        } = req.body;

        // Get part info to validate question number range
        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Part không tồn tại',
            });
            return;
        }

        // Validate question number range based on part number
        const qNum = parseInt(questionNumber);
        if (part.partNumber === 5) {
            if (qNum < 101 || qNum > 130) {
                res.status(400).json({
                    success: false,
                    message: 'Part 5 chỉ chấp nhận câu hỏi từ 101 đến 130',
                });
                return;
            }
        } else if (part.partNumber === 6) {
            if (qNum < 131 || qNum > 146) {
                res.status(400).json({
                    success: false,
                    message: 'Part 6 chỉ chấp nhận câu hỏi từ 131 đến 146',
                });
                return;
            }
        }

        // Check if question number already exists in the ENTIRE TEST
        // We need to find if any question in any part of this test has this number
        const existingQuestionInTest = await prisma.question.findFirst({
            where: {
                part: {
                    testId: part.testId
                },
                questionNumber: qNum
            },
            include: {
                part: true
            }
        });

        if (existingQuestionInTest) {
            res.status(400).json({
                success: false,
                message: `Câu hỏi số ${questionNumber} đã tồn tại trong Part ${existingQuestionInTest.part.partNumber} của bài test này.`,
            });
            return;
        }

        const newQuestion = await (prisma.question as any).create({
            data: {
                partId,
                questionNumber: qNum,
                questionText,
                optionA,
                optionB,
                optionC,
                optionD,
                correctAnswer,
                explanation,
                analysis, // ✅ New
                evidence, // ✅ New
                questionTranslation, // ✅ New
                optionTranslations, // ✅ New
                keyVocabulary, // ✅ New
                passageTitle, // ✅ New
                level, // ✅ New

                audioUrl,
                imageUrl, // Add imageUrl
                transcript,
                status: 'PENDING' as any // Default to PENDING for new questions
            },
        });

        res.status(201).json({
            success: true,
            message: 'Tạo câu hỏi thành công',
            question: newQuestion,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a question
 * PATCH /api/questions/:id
 */
export const updateQuestion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            questionNumber,
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            explanation,
            analysis, // ✅ New
            evidence, // ✅ New
            questionTranslation, // ✅ New
            optionTranslations, // ✅ New
            keyVocabulary, // ✅ New
            passageTitle, // ✅ New
            level, // ✅ New
            passage,
            audioUrl,
            imageUrl,
            transcript,
            passageImageUrl, // ✅ New: dedicated passage image URLs
            questionScanUrl, // ✅ New: dedicated question scan URLs
            passageTranslationData,
        } = req.body;

        // Validate and Standardize
        let sanitizedData: string | null = null;
        if (passageTranslationData) {
            sanitizedData = validateAndStandardizePassageData(passageTranslationData);
        }

        const updatedQuestion = await (prisma.question as any).update({
            where: { id },
            data: {
                questionNumber: questionNumber ? parseInt(questionNumber) : undefined,
                questionText,
                optionA,
                optionB,
                optionC,
                optionD,
                correctAnswer,
                explanation,
                analysis, // ✅ New
                evidence, // ✅ New
                questionTranslation, // ✅ New
                optionTranslations, // ✅ New
                keyVocabulary, // ✅ New
                passageTitle, // ✅ New
                level, // ✅ New
                passage,
                audioUrl,
                imageUrl,
                transcript,
                passageImageUrl,
                questionScanUrl,
                passageTranslationData: sanitizedData,
            },
        });

        // Removed redundant updateMany sync. The frontend now handles patching all questions in a group explicitly.
        
        res.status(200).json({
            success: true,
            message: 'Cập nhật câu hỏi thành công',
            question: updatedQuestion,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a question
 * DELETE /api/questions/:id
 */
export const deleteQuestion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chỉ ADMIN mới có quyền xóa câu hỏi.',
            });
            return;
        }
        // Get question to extract image/audio URLs before deleting
        const question = await prisma.question.findUnique({
            where: { id },
        });

        if (!question) {
            res.status(404).json({
                success: false,
                message: 'Câu hỏi không tồn tại',
            });
            return;
        }

        // Delete from database
        await prisma.question.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: 'Xóa câu hỏi thành công',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete all questions in a Part
 * DELETE /api/parts/:partId/questions
 */
export const deleteAllQuestionsByPartId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chỉ ADMIN mới có quyền xóa toàn bộ câu hỏi của phần thi.',
            });
            return;
        }

        // Get all questions first to cleanup assets
        const questions = await prisma.question.findMany({
            where: { partId },
            select: {
                imageUrl: true,
                audioUrl: true,
                passageImageUrl: true,
                questionScanUrl: true
            }
        });

        const result = await prisma.question.deleteMany({
            where: { partId },
        });

        // Cleanup Cloudinary assets
        const { cleanupCloudinaryAssets } = await import('../config/cloudinary.config');
        questions.forEach(q => {
            cleanupCloudinaryAssets(q.imageUrl);
            cleanupCloudinaryAssets(q.audioUrl);
            cleanupCloudinaryAssets(q.passageImageUrl);
            cleanupCloudinaryAssets(q.questionScanUrl);
        });

        res.status(200).json({
            success: true,
            message: `Đã xóa ${result.count} câu hỏi`,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk delete questions by IDs
 * DELETE /api/questions/bulk
 */
export const bulkDeleteQuestions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chỉ ADMIN mới có quyền xóa hàng loạt câu hỏi.',
            });
            return;
        }
        const { questionIds } = req.body;

        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp danh sách ID câu hỏi',
            });
            return;
        }

        // Get questions first to cleanup assets
        const questions = await prisma.question.findMany({
            where: {
                id: { in: questionIds }
            },
            select: {
                imageUrl: true,
                audioUrl: true,
                passageImageUrl: true,
                questionScanUrl: true
            }
        });

        const result = await prisma.question.deleteMany({
            where: {
                id: {
                    in: questionIds,
                },
            },
        });

        // Cleanup Cloudinary assets
        const { cleanupCloudinaryAssets } = await import('../config/cloudinary.config');
        questions.forEach(q => {
            cleanupCloudinaryAssets(q.imageUrl);
            cleanupCloudinaryAssets(q.audioUrl);
            cleanupCloudinaryAssets(q.passageImageUrl);
            cleanupCloudinaryAssets(q.questionScanUrl);
        });

        res.status(200).json({
            success: true,
            message: `Đã xóa ${result.count} câu hỏi`,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create batch questions (Part 6)
 * POST /api/parts/:partId/questions/batch
 */
export const createBatchQuestions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const { passage, passageTranslationData, questions, audioUrl, transcript, mode } = req.body; // mode: 'append' | 'replace'

        // Validate and Standardize
        let sanitizedData: string | null = null;
        if (passageTranslationData) {
            sanitizedData = validateAndStandardizePassageData(passageTranslationData);
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Danh sách câu hỏi không được để trống',
            });
            return;
        }

        // Get part info for validation
        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Part không tồn tại',
            });
            return;
        }

        // Validate passage requirement based on Part number
        // ✅ Nới lỏng kiểm tra: Chấp nhận nếu có text 'passage' HOẶC có ảnh 'passageImageUrl' (chuỗi không rỗng)
        const firstQuestionPassageImage = questions[0]?.passageImageUrl;
        const hasPassage = (passage && passage.trim().length > 0) || (firstQuestionPassageImage && firstQuestionPassageImage.trim().length > 0);
        
        console.log(`[Batch Save] Part: ${part.partNumber}, hasPassageText: ${!!passage}, hasPassageImage: ${!!firstQuestionPassageImage}`);

        if ((part.partNumber === 6 || part.partNumber === 7) && !hasPassage) {
            res.status(400).json({
                success: false,
                message: 'Đoạn văn là bắt buộc đối với Part 6 và 7 (Vui lòng nhập văn bản hoặc upload ảnh đoạn văn)',
            });
            return;
        }

        // Handle replace mode for Part 5: delete all existing questions first
        if (mode === 'replace' && part.partNumber === 5) {
            await prisma.question.deleteMany({
                where: { partId },
            });
        }

        // For append mode, check if adding would exceed limit
        if (mode === 'append' && part.partNumber === 5) {
            const existingCount = await prisma.question.count({
                where: { partId },
            });
            const totalAfterImport = existingCount + questions.length;
            if (totalAfterImport > 30) {
                res.status(400).json({
                    success: false,
                    message: `Không thể import. Tổng số câu sẽ vượt quá 30 (${existingCount} + ${questions.length} = ${totalAfterImport})`,
                });
                return;
            }
        }

        // Get last question number
        const lastQuestion = await prisma.question.findFirst({
            where: { partId },
            orderBy: { questionNumber: 'desc' },
        });

        // For Part 6/7, use standard logic. For Part 5, check start number
        let startQuestionNumber = lastQuestion ? lastQuestion.questionNumber + 1 : (part.partNumber === 6 ? 131 : part.partNumber === 5 ? 101 : 1);

        // Check for duplicate question numbers in existing questions
        const existingQuestions = await prisma.question.findMany({
            where: { partId },
            select: { questionNumber: true }
        });
        const existingNumbers = new Set(existingQuestions.map(q => q.questionNumber));

        // Check for duplicates in incoming questions
        const incomingNumbers = questions.map((q: any, index: number) =>
            q.questionNumber ? q.questionNumber : (startQuestionNumber + index)
        );

        const duplicates = incomingNumbers.filter(num => existingNumbers.has(num));
        if (duplicates.length > 0) {
            res.status(400).json({
                success: false,
                message: `Các câu sau đã tồn tại: ${duplicates.join(', ')}. Vui lòng kiểm tra lại.`,
            });
            return;
        }

        // Prepare data
        const questionsToInsert = questions.map((q: any, index: number) => {
            const qNum = q.questionNumber ? q.questionNumber : (startQuestionNumber + index);

            // Basic validation
            if (!q.correctAnswer) {
                throw new Error(`Câu ${qNum} thiếu đáp án đúng.`);
            }
            if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) {
                throw new Error(`Câu ${qNum} thiếu một hoặc nhiều lựa chọn (A-D).`);
            }

            // Validate Part 5 question number range
            if (part.partNumber === 5 && (qNum < 101 || qNum > 130)) {
                throw new Error(`Part 5 chỉ chấp nhận câu hỏi từ 101-130. Câu ${qNum} không hợp lệ.`);
            }

            // Validate Part 6 question number range
            if (part.partNumber === 6 && (qNum < 131 || qNum > 146)) {
                throw new Error(`Part 6 chỉ chấp nhận câu hỏi từ 131-146. Câu ${qNum} không hợp lệ.`);
            }

            // Validate Part 7 question number range
            if (part.partNumber === 7 && (qNum < 147 || qNum > 200)) {
                throw new Error(`Part 7 chỉ chấp nhận câu hỏi từ 147-200. Câu ${qNum} không hợp lệ.`);
            }

            return {
                partId,
                questionNumber: qNum,
                passage: passage,
                passageTranslationData: sanitizedData,
                passageImageUrl: q.passageImageUrl || null,
                questionScanUrl: q.questionScanUrl || null,
                questionText: q.questionText,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                analysis: q.analysis || null, // ✅ New
                evidence: q.evidence || null, // ✅ New
                questionTranslation: q.questionTranslation || null, // ✅ New
                optionTranslations: q.optionTranslations || null, // ✅ New
                keyVocabulary: q.keyVocabulary || null, // ✅ New
                passageTitle: q.passageTitle || null, // ✅ New
                level: sanitizeDifficulty(q.level), // ✅ Sanitized
                audioUrl: audioUrl || q.audioUrl,
                transcript: transcript || q.transcript,
                imageUrl: q.imageUrl || null,
                status: 'PENDING' as any // Default to PENDING for batch questions
            };
        });

        // Check for duplicate question numbers in ENTIRE TEST
        const questionNumbers = questionsToInsert.map(q => q.questionNumber);

        const existingQuestionsInTest = await prisma.question.findMany({
            where: {
                part: {
                    testId: part.testId
                },
                questionNumber: {
                    in: questionNumbers
                }
            },
            select: {
                questionNumber: true,
                part: {
                    select: { partNumber: true }
                }
            }
        });

        // Only check for duplicates if NOT in replace mode
        if (mode !== 'replace' && existingQuestionsInTest.length > 0) {
            const duplicateNumbers = existingQuestionsInTest.map(q => q.questionNumber).sort((a, b) => a - b);
            // Show where they exist
            const duplicatesInfo = existingQuestionsInTest.map(q => `${q.questionNumber} (Part ${q.part.partNumber})`).join(', ');

            res.status(400).json({
                success: false,
                message: `Các câu hỏi sau đã tồn tại trong bài test: ${duplicatesInfo}. Vui lòng kiểm tra lại.`,
                duplicates: duplicateNumbers
            });
            return;
        }

        // Deep Diagnostic
        console.log('--- DIAGNOSTIC START ---');
        console.log('Difficulty Enum Runtime:', Object.values(Difficulty));
        console.log('First Question Data:', JSON.stringify(questionsToInsert[0], null, 2));
        console.log('--- DIAGNOSTIC END ---');

        // Bulk insert
        await (prisma.question as any).createMany({
            data: questionsToInsert,
        });

        res.status(201).json({
            success: true,
            message: `Đã tạo ${questionsToInsert.length} câu hỏi thành công`,
            count: questionsToInsert.length,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Import questions from Excel (Part 5 or Part 6)
 * POST /api/parts/:partId/questions/import
 */
export const importQuestions = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { partId } = req.params;
        const mode = req.body.mode || 'append'; // Default to append mode
        console.log('Start Import for Part:', partId, 'Mode:', mode);

        if (!req.file) {
            console.log('No file received');
            res.status(400).json({
                success: false,
                message: 'Vui lòng upload file Excel',
            });
            return;
        }

        console.log('File received:', req.file.originalname, req.file.size);

        // Get Part info to determine which parser to use
        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Part không tồn tại',
            });
            return;
        }

        // Use ExcelParser to parse and validate
        const { ExcelParser } = await import('../utils/excelParser');

        // Choose parser based on Part number
        let questions: any[];
        if (part.partNumber === 5) {
            questions = ExcelParser.parsePart5Template(req.file.buffer);
        } else if (part.partNumber === 6) {
            questions = ExcelParser.parsePart6Template(req.file.buffer);
        } else {
            res.status(400).json({
                success: false,
                message: `Import chưa được hỗ trợ cho Part ${part.partNumber}`,
            });
            return;
        }

        console.log(`Parsed ${questions.length} valid questions`);

        // Handle replace mode: delete all existing questions first
        if (mode === 'replace') {
            const deletedCount = await prisma.question.deleteMany({
                where: { partId },
            });
            console.log(`Deleted ${deletedCount.count} existing questions`);
        }

        // SMART IMPORT LOGIC: Fill in only missing questions
        // 1. Get all existing question numbers for this ENTIRE TEST
        // (If replace mode, we already deleted questions in THIS part, so we get questions from OTHER parts)
        const existingQuestions = await prisma.question.findMany({
            where: {
                part: {
                    testId: part.testId
                }
            },
            select: { questionNumber: true },
        });
        const existingSet = new Set(existingQuestions.map(q => q.questionNumber));

        // 2. Check if part is already full (only for append mode)
        if (mode === 'append') {
            const maxQuestions = part.partNumber === 5 ? 30 : part.partNumber === 6 ? 16 : null;
            if (maxQuestions && existingQuestions.length >= maxQuestions) {
                res.status(400).json({
                    success: false,
                    message: `Part ${part.partNumber} đã đủ ${maxQuestions} câu hỏi. Vui lòng sử dụng chế độ "Ghi đè" hoặc xóa câu hỏi cũ trước.`,
                });
                return;
            }
        }

        // 3. Prepare data, skipping existing numbers and validating ranges
        const questionsToInsert: any[] = [];
        const invalidQuestions: number[] = [];

        questions.forEach((q, index) => {
            // Use questionNumber from Excel if available, otherwise fallback to index + 1 (NOT RECOMMENDED for Part 5)
            // For Part 5, we expect the Excel to have 101-130 range.
            const contentNumber = (q as any).questionNumber || (index + 1);

            // Validate question number range for Part 5 and Part 6
            if (part.partNumber === 5) {
                if (contentNumber < 101 || contentNumber > 130) {
                    invalidQuestions.push(contentNumber);
                    return; // Skip this question
                }
            } else if (part.partNumber === 6) {
                if (contentNumber < 131 || contentNumber > 146) {
                    invalidQuestions.push(contentNumber);
                    return; // Skip this question
                }
            }

            if (!existingSet.has(contentNumber)) {
                questionsToInsert.push({
                    partId,
                    questionNumber: contentNumber,
                    passage: (q as any).passage || null,
                    questionText: q.questionText,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation,
                    status: 'PENDING' as any // Default to PENDING for imported questions
                });
            }
        });

        // Check if there are invalid question numbers
        if (invalidQuestions.length > 0) {
            const rangeMsg = part.partNumber === 5
                ? 'Part 5 chỉ chấp nhận câu hỏi từ 101-130'
                : 'Part 6 chỉ chấp nhận câu hỏi từ 131-146';
            res.status(400).json({
                success: false,
                message: `${rangeMsg}. Các câu không hợp lệ: ${invalidQuestions.join(', ')}`,
            });
            return;
        }

        console.log(`Smart Import: Found ${questionsToInsert.length} missing questions to insert.`);

        if (questionsToInsert.length > 0) {
            await prisma.question.createMany({
                data: questionsToInsert,
            });
        }

        const modeMessage = mode === 'replace'
            ? `Đã thay thế toàn bộ bằng ${questionsToInsert.length} câu hỏi mới`
            : `Đã import thành công ${questionsToInsert.length} câu hỏi`;

        res.status(201).json({
            success: true,
            message: modeMessage,
            count: questionsToInsert.length,
        });

    } catch (error: any) {
        console.error('Import error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Lỗi khi import file Excel',
        });
    }
};

/**
 * Download Excel Template
 * GET /api/questions/template?partNumber=5 or 6
 */
export const downloadTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const partNumber = parseInt(req.query.partNumber as string) || 5; // Default to Part 5
        console.log('📥 Download template request - partNumber:', partNumber, 'query:', req.query);

        let templatePath: string;
        let fileName: string;

        if (partNumber === 5) {
            templatePath = path.join(__dirname, '..', '..', '..', 'toeic_practice_admin', 'public', 'templates', 'part5_template.xlsx');
            fileName = 'Part5_Template.xlsx';
        } else if (partNumber === 6) {
            templatePath = path.join(__dirname, '..', '..', '..', 'toeic_practice_admin', 'public', 'templates', 'part6_template.xlsx');
            fileName = 'Part6_Template.xlsx';
        } else {
            res.status(400).json({
                success: false,
                message: `Template chưa được hỗ trợ cho Part ${partNumber}`,
            });
            return;
        }

        console.log('📂 Template path:', templatePath);
        console.log('📄 File name:', fileName);

        // Check if file exists
        if (!fs.existsSync(templatePath)) {
            console.log('❌ File does not exist at path:', templatePath);
            res.status(404).json({
                success: false,
                message: 'Template file không tồn tại',
            });
            return;
        }

        // Send file
        res.download(templatePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading template:', err);
                next(err);
            }
        });
    } catch (error) {
        next(error);
    }
};



/**
 * Approve a question (ADMIN only)
 * PATCH /api/questions/:id/approve
 */
export const approveQuestion = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chào bạn, chỉ ADMIN mới có quyền duyệt câu hỏi. Vui lòng liên hệ quản trị viên.',
            });
            return;
        }

        const updatedQuestion = await (prisma.question as any).update({
            where: { id },
            data: { status: 'ACTIVE' },
        });

        res.status(200).json({
            success: true,
            message: 'Đã duyệt câu hỏi thành công!',
            question: updatedQuestion,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle lock/unlock status of a question (ADMIN only)
 * PATCH /api/questions/:id/toggle-lock
 */
export const toggleQuestionLock = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== 'ADMIN') {
            res.status(403).json({
                success: false,
                message: 'Chào bạn, chỉ ADMIN mới có quyền khóa/khôi phục câu hỏi. Vui lòng liên hệ quản trị viên.',
            });
            return;
        }

        const question = await prisma.question.findUnique({ where: { id } });
        if (!question) {
            res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi.' });
            return;
        }

        const newStatus = (question as any).status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
        const updatedQuestion = await (prisma.question as any).update({
            where: { id },
            data: { status: newStatus },
        });

        res.status(200).json({
            success: true,
            message: newStatus === 'LOCKED' ? 'Đã khóa câu hỏi thành công!' : 'Đã khôi phục câu hỏi thành công!',
            question: updatedQuestion,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk toggle status for multiple questions
 * PATCH /api/questions/bulk-status
 */
export const bulkToggleStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { questionIds, status } = req.body;

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({ success: false, message: 'Danh sách câu hỏi không hợp lệ.' });
            return;
        }

        const validStatuses = ['ACTIVE', 'LOCKED', 'PENDING'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ success: false, message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}` });
            return;
        }

        const result = await (prisma.question as any).updateMany({
            where: { id: { in: questionIds } },
            data: { status },
        });

        res.status(200).json({
            success: true,
            message: `Đã cập nhật trạng thái ${result.count} câu hỏi thành ${status}`,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};
