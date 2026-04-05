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
    translateWord,
    enrichPart5Question,
    enrichPart5Batch,
    getAiTimeline
} from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import multer from 'multer';

const upload = multer();
const router = Router();

// Protected route - only authenticated admins can generate AI explanations
router.post('/generate-part6', authMiddleware, generatePart6Explanations);
router.post('/generate-explanation', authMiddleware, generateExplanation);
router.post('/generate-batch-explanations', authMiddleware, generateBatchExplanations);

// Part 5 specific AI Auto-Parser routes
router.post('/enrich-part5', authMiddleware, enrichPart5Question);
router.post('/enrich-part5-batch', authMiddleware, enrichPart5Batch);

// Multimodal Scan routes
router.post('/scan-part7', authMiddleware, upload.single('image'), scanPart7);
router.post('/magic-scan-part7', authMiddleware, upload.fields([{ name: 'passageImages', maxCount: 10 }, { name: 'questionImages', maxCount: 10 }]), magicScanPart7);
router.post('/scan-part6', authMiddleware, upload.single('image'), scanPart6);
router.post('/magic-scan-part6', authMiddleware, upload.fields([{ name: 'passageImages', maxCount: 10 }, { name: 'questionImages', maxCount: 10 }]), magicScanPart6);
router.post('/generate-part7', authMiddleware, upload.array('images'), generatePart7Explanations);
router.post('/translate-word', authMiddleware, translateWord);

// AI Timeline & Coaching Journey
router.get('/timeline/:userId', authMiddleware, getAiTimeline);

export default router;
