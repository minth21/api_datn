import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all parts of a test
 * GET /api/tests/:testId/parts
 */
export const getPartsByTestId = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { testId } = req.params;

        const parts = await prisma.part.findMany({
            where: { testId },
            include: {
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
            orderBy: {
                partNumber: 'asc',
            },
        });

        // Add completedQuestions count
        const partsWithProgress = parts.map(part => ({
            ...part,
            completedQuestions: part._count.questions,
        }));

        res.status(200).json({
            success: true,
            parts: partsWithProgress,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get part by ID
 * GET /api/parts/:partId
 */
export const getPartById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;

        const part = await prisma.part.findUnique({
            where: { id: partId },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy Part',
            });
            return;
        }

        res.status(200).json({
            success: true,
            part,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new part
 * POST /api/tests/:testId/parts
 */
export const createPart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { testId } = req.params;
        const { partNumber, partName, totalQuestions, instructions, status, orderIndex, timeLimit } = req.body;

        // Validate totalQuestions
        const totalQuestionsNum = parseInt(totalQuestions);
        if (totalQuestionsNum <= 0) {
            res.status(400).json({
                success: false,
                message: 'Tổng số câu hỏi phải lớn hơn 0',
            });
            return;
        }

        // Check if part number already exists
        const existingPart = await prisma.part.findFirst({
            where: {
                testId,
                partNumber: parseInt(partNumber),
            },
        });

        if (existingPart) {
            res.status(400).json({
                success: false,
                message: `Part ${partNumber} đã tồn tại trong test này`,
            });
            return;
        }

        const newPart = await prisma.part.create({
            data: {
                testId,
                partNumber: parseInt(partNumber),
                partName,
                totalQuestions: totalQuestionsNum,
                instructions: instructions || null,
                status: status || 'ACTIVE',
                orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : parseInt(partNumber),
                timeLimit: timeLimit ? parseInt(timeLimit) : null,
            },
        });

        res.status(201).json({
            success: true,
            message: 'Part được tạo thành công',
            part: newPart,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update part
 * PATCH /api/parts/:partId
 */
export const updatePart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;
        const { partNumber, partName, totalQuestions, instructions, status, orderIndex, timeLimit } = req.body;

        // Validate totalQuestions if provided
        if (totalQuestions !== undefined) {
            const totalQuestionsNum = parseInt(totalQuestions);
            if (totalQuestionsNum <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Tổng số câu hỏi phải lớn hơn 0',
                });
                return;
            }
        }

        const updatedPart = await prisma.part.update({
            where: { id: partId },
            data: {
                partNumber: partNumber ? parseInt(partNumber) : undefined,
                partName,
                totalQuestions: totalQuestions ? parseInt(totalQuestions) : undefined,
                instructions: instructions !== undefined ? instructions : undefined,
                status: status || undefined,
                orderIndex: orderIndex !== undefined ? parseInt(orderIndex) : undefined,
                timeLimit: timeLimit !== undefined ? (timeLimit ? parseInt(timeLimit) : null) : undefined,
            },
        });

        res.status(200).json({
            success: true,
            message: 'Part được cập nhật thành công',
            part: updatedPart,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete part
 * DELETE /api/parts/:partId
 */
export const deletePart = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { partId } = req.params;

        // Check if part has questions
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: {
                _count: {
                    select: {
                        questions: true,
                    },
                },
            },
        });

        if (!part) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy Part',
            });
            return;
        }

        if (part._count.questions > 0) {
            res.status(400).json({
                success: false,
                message: `Không thể xóa Part vì còn ${part._count.questions} câu hỏi. Vui lòng xóa câu hỏi trước.`,
            });
            return;
        }

        await prisma.part.delete({
            where: { id: partId },
        });

        res.status(200).json({
            success: true,
            message: 'Part đã được xóa thành công',
        });
    } catch (error) {
        next(error);
    }
};
