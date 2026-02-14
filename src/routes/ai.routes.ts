import { Router } from 'express';
import { generatePart6Explanations, generateExplanation } from '../controllers/ai.controller';
import { generateBatchExplanations } from '../controllers/aiBatch.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Protected route - only authenticated admins can generate AI explanations
router.post('/generate-part6', authMiddleware, generatePart6Explanations);
router.post('/generate-explanation', authMiddleware, generateExplanation);
router.post('/generate-batch-explanations', authMiddleware, generateBatchExplanations);

export default router;
