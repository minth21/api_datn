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
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Download Template (Protected)
router.get('/questions/template', authMiddleware, downloadTemplate);

// Get all questions by Part ID
router.get('/parts/:partId/questions', authMiddleware, getQuestionsByPartId);

// Create single question (REVIEWER được phép tạo)
router.post('/parts/:partId/questions', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'REVIEWER']), createQuestion);

// Create batch questions (Part 6) (REVIEWER được phép tạo)
router.post('/parts/:partId/questions/batch', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'REVIEWER']), createBatchQuestions);

// Import questions from Excel (REVIEWER được phép import)
router.post('/parts/:partId/questions/import', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'REVIEWER']), upload.single('file'), importQuestions);

// Update question (REVIEWER được phép sửa)
router.patch('/questions/:id', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST', 'REVIEWER']), updateQuestion);

// ==========================================
// CÁC QUYỀN XÓA (CHỈ ADMIN & SPECIALIST ĐƯỢC PHÉP)
// ==========================================

// Bulk delete questions (MUST BE BEFORE /:id)
router.delete('/questions/bulk', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), bulkDeleteQuestions);

// Delete question
router.delete('/questions/:id', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), deleteQuestion);

// Delete all questions in a Part
router.delete('/parts/:partId/questions', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), deleteAllQuestionsByPartId);

export default router;
