import express from 'express';
import multer from 'multer';
import {
    getQuestionsByPartId,
    createQuestion,
    importQuestions,
    updateQuestion,
    deleteQuestion,
    approveQuestion,
    toggleQuestionLock,
    deleteAllQuestionsByPartId,
    bulkDeleteQuestions,
    createBatchQuestions,
    downloadTemplate,
    bulkToggleStatus,
} from '../controllers/question.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Download Template (Protected)
router.get('/questions/template', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'TEACHER'] as any[]), downloadTemplate);

// Get all questions by Part ID
router.get('/parts/:partId/questions', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'TEACHER', 'STUDENT'] as any[]), getQuestionsByPartId);

// Create single question
router.post('/parts/:partId/questions', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), createQuestion);

// Create batch questions (Part 6)
router.post('/parts/:partId/questions/batch', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), createBatchQuestions);

// Import questions from Excel
router.post('/parts/:partId/questions/import', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), upload.single('file'), importQuestions);

// Update question
router.patch('/questions/:id', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), updateQuestion);

// Approve question (ADMIN only)
router.patch('/questions/:id/approve', authMiddleware, roleMiddleware(['ADMIN']), approveQuestion);

// Toggle lock question (ADMIN only)
router.patch('/questions/:id/toggle-lock', authMiddleware, roleMiddleware(['ADMIN']), toggleQuestionLock);

// ==========================================
// CÁC QUYỀN XÓA (CHỈ ADMIN & SPECIALIST ĐƯỢC PHÉP)
// ==========================================

// Bulk delete questions (MUST BE BEFORE /:id)
router.delete('/questions/bulk', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), bulkDeleteQuestions);

// Bulk toggle status (MUST BE BEFORE /:id)
router.patch('/questions/bulk-status', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), bulkToggleStatus);

// Delete question
router.delete('/questions/:id', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), deleteQuestion);

// Delete all questions in a Part
router.delete('/parts/:partId/questions', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), deleteAllQuestionsByPartId);

export default router;
