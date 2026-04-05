import { Router } from 'express';
import * as flashcardController from '../controllers/flashcard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Routes protected by authMiddleware to ensure req.user is populated
router.get('/flashcards', authMiddleware, flashcardController.getMyFlashcards);
router.post('/flashcards/bulk', authMiddleware, flashcardController.bulkCreateFlashcards);
router.delete('/flashcards/:id', authMiddleware, flashcardController.deleteFlashcard);

export default router;
