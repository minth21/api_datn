import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all tests
 * GET /api/tests
 */
export const getTests = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const difficulty = req.query.difficulty as string;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        // Build filtering criteria
        const where: any = {};

        if (difficulty && difficulty !== 'ALL') {
            where.difficulty = difficulty;
        }

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Get total count
        const total = await prisma.test.count({ where });

        // Get tests with parts count
        const tests = await prisma.test.findMany({
            where,
            include: {
                parts: {
                    select: {
                        id: true,
                        partNumber: true,
                        totalQuestions: true,
                        _count: {
                            select: {
                                questions: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        });

        // Calculate completion and listening/reading for each test
        const testsWithProgress = tests.map(test => {
            const totalParts = 7;
            const completedParts = test.parts.length;

            // Calculate listeningQuestions and readingQuestions from testType
            const listeningQuestions = (test as any).testType === 'LISTENING' ? (test as any).totalQuestions : 0;
            const readingQuestions = (test as any).testType === 'READING' ? (test as any).totalQuestions : 0;

            return {
                ...test,
                totalParts,
                completedParts,
                progress: Math.round((completedParts / totalParts) * 100),
                listeningQuestions,
                readingQuestions,
            };
        });

        res.status(200).json({
            success: true,
            tests: testsWithProgress,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get test by ID
 * GET /api/tests/:id
 */
export const getTestById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const test = await prisma.test.findUnique({
            where: { id },
            include: {
                parts: {
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
                },
            },
        });

        if (!test) {
            res.status(404).json({
                success: false,
                message: 'Test not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            test,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new test
 * POST /api/tests
 */
export const createTest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { title, testType, difficulty, status, duration, totalQuestions } = req.body;

        const newTest = await prisma.test.create({
            data: {
                title,
                testType,
                difficulty,
                status: status || 'LOCKED',
                duration: parseInt(duration),
                totalQuestions: parseInt(totalQuestions),
            } as any,
        });

        // Calculate listening/reading for response
        const listeningQuestions = (newTest as any).testType === 'LISTENING' ? (newTest as any).totalQuestions : 0;
        const readingQuestions = (newTest as any).testType === 'READING' ? (newTest as any).totalQuestions : 0;

        res.status(201).json({
            success: true,
            message: 'Test created successfully',
            test: {
                ...newTest,
                listeningQuestions,
                readingQuestions,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update test
 * PATCH /api/tests/:id
 */
export const updateTest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, testType, difficulty, status, duration, totalQuestions } = req.body;

        const updatedTest = await prisma.test.update({
            where: { id },
            data: {
                title,
                testType,
                difficulty,
                status,
                duration: duration ? parseInt(duration) : undefined,
                totalQuestions: totalQuestions ? parseInt(totalQuestions) : undefined,
            } as any,
        });

        // Calculate listening/reading for response
        const listeningQuestions = (updatedTest as any).testType === 'LISTENING' ? (updatedTest as any).totalQuestions : 0;
        const readingQuestions = (updatedTest as any).testType === 'READING' ? (updatedTest as any).totalQuestions : 0;

        res.status(200).json({
            success: true,
            message: 'Test updated successfully',
            test: {
                ...updatedTest,
                listeningQuestions,
                readingQuestions,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete test
 * DELETE /api/tests/:id
 */
export const deleteTest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        await prisma.test.delete({
            where: { id },
        });

        res.status(200).json({
            success: true,
            message: 'Test deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
