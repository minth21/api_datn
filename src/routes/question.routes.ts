import express from 'express';
import multer from 'multer';
import {
    getQuestionsByPartId,
    createQuestion,
    importQuestions,
    updateQuestion,
    deleteQuestion,
    deleteAllQuestionsByPartId,
    bulkDeleteQuestions,
    createBatchQuestions,
    downloadTemplate,
} from '../controllers/question.controller';
import { generateBatchExplanations } from '../controllers/batchAi.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Download Template (Public or Protected? Let's protect it)
router.get('/questions/template', authMiddleware, downloadTemplate);

// Get all questions by Part ID
router.get('/parts/:partId/questions', authMiddleware, getQuestionsByPartId);

// Create single question
router.post('/parts/:partId/questions', authMiddleware, createQuestion);

// Create batch questions (Part 6)
router.post('/parts/:partId/questions/batch', authMiddleware, createBatchQuestions);

// Import questions from Excel
router.post('/parts/:partId/questions/import', authMiddleware, upload.single('file'), importQuestions);

// Generate AI explanations for multiple questions
router.post('/parts/:partId/questions/generate-explanations', authMiddleware, generateBatchExplanations);

// Update question
router.patch('/questions/:id', authMiddleware, updateQuestion);

// Bulk delete questions (MUST BE BEFORE /:id)
router.delete('/questions/bulk', authMiddleware, bulkDeleteQuestions);

// Delete question
router.delete('/questions/:id', authMiddleware, deleteQuestion);

// Delete all questions in a Part
router.delete('/parts/:partId/questions', authMiddleware, deleteAllQuestionsByPartId);

export default router;
