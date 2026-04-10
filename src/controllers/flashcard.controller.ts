import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all flashcards for a user
 * GET /api/flashcards
 */
export const getMyFlashcards = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id || req.query.userId as string;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const flashcards = await prisma.flashcard.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                part: {
                    select: {
                        partName: true,
                        test: { select: { title: true } }
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: flashcards
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create bulk flashcards
 * POST /api/flashcards/bulk
 */
export const bulkCreateFlashcards = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userId, flashcards, partId } = req.body;

        if (!userId || !flashcards || !Array.isArray(flashcards)) {
            res.status(400).json({ success: false, message: 'Missing required fields' });
            return;
        }

        const data = flashcards.map((f: any) => ({
            userId,
            word: f.word,
            meaning: f.meaning,
            ipa: f.ipa || f.pronunciation,
            exampleEn: f.exampleEn,
            exampleVi: f.exampleVi,
            partId: partId || null,
        }));

        // createMany is not available in some Prisma versions for all DBs, 
        // using loop for safer execution on smaller batches (usually < 10 items)
        const created = await Promise.all(
            data.map(item => prisma.flashcard.create({ data: item }))
        );

        res.status(201).json({
            success: true,
            message: `Created ${created.length} flashcards`,
            data: created
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a flashcard
 * DELETE /api/flashcards/:id
 */
export const deleteFlashcard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        await prisma.flashcard.delete({
            where: { 
                id,
                // Ensure user can only delete their own cards if userId is available
                ...(userId ? { userId } : {})
            }
        });

        res.status(200).json({
            success: true,
            message: 'Flashcard deleted'
        });
    } catch (error) {
        next(error);
    }
};
