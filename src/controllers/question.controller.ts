import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

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

        const questions = await prisma.question.findMany({
            where: { partId },
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

        const newQuestion = await prisma.question.create({
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
            passage, // Add passage
        } = req.body;

        const updatedQuestion = await prisma.question.update({
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
                passage, // Add passage to update
            },
        });

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

        const result = await prisma.question.deleteMany({
            where: { partId },
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
        const { questionIds } = req.body;

        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp danh sách ID câu hỏi',
            });
            return;
        }

        const result = await prisma.question.deleteMany({
            where: {
                id: {
                    in: questionIds,
                },
            },
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
        const { passage, questions } = req.body; // questions is array of { questionText, options..., correctAnswer, explanation }

        if (!passage || !Array.isArray(questions) || questions.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Thiếu thông tin đoạn văn hoặc danh sách câu hỏi',
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

        // Get last question number
        const lastQuestion = await prisma.question.findFirst({
            where: { partId },
            orderBy: { questionNumber: 'desc' },
        });

        // For Part 6, start from 131 if no questions exist
        let startQuestionNumber = lastQuestion ? lastQuestion.questionNumber + 1 : (part.partNumber === 6 ? 131 : 1);

        // Prepare data
        const questionsToInsert = questions.map((q: any, index: number) => {
            const qNum = q.questionNumber ? q.questionNumber : (startQuestionNumber + index);

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
                questionText: q.questionText,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
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

        if (existingQuestionsInTest.length > 0) {
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

        // Bulk insert
        await prisma.question.createMany({
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
