import { Router } from 'express';
import {
    generatePart6Explanations,
    generateExplanation,
    generateBatchExplanations,
    scanPart7,
    scanPart6,
    generatePart7Explanations,
    magicScanPart7,
    magicScanPart6,
    translateWord
} from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import multer from 'multer';

const upload = multer();
const router = Router();

// Protected route - only authenticated admins can generate AI explanations
router.post('/generate-part6', authMiddleware, generatePart6Explanations);
router.post('/generate-explanation', authMiddleware, generateExplanation);
router.post('/generate-batch-explanations', authMiddleware, generateBatchExplanations);

// Multimodal Scan routes
router.post('/scan-part7', authMiddleware, upload.single('image'), scanPart7);
router.post('/magic-scan-part7', authMiddleware, upload.array('images'), magicScanPart7);
router.post('/scan-part6', authMiddleware, upload.single('image'), scanPart6);
router.post('/magic-scan-part6', authMiddleware, upload.array('images'), magicScanPart6);
router.post('/generate-part7', authMiddleware, upload.array('images'), generatePart7Explanations);
router.post('/translate-word', authMiddleware, translateWord);

export default router;
