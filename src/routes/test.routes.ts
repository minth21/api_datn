import express from 'express';
import {
    getTests,
    getTestById,
    createTest,
    updateTest,
    deleteTest,
    approveTest,
    approveTestFull,
    toggleTestLock,
    rejectTest,
} from '../controllers/test.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/tests - Get all tests
router.get('/', roleMiddleware(['ADMIN', 'SPECIALIST', 'TEACHER', 'STUDENT'] as any[]), getTests);

// GET /api/tests/:id - Get test by ID
router.get('/:id', roleMiddleware(['ADMIN', 'SPECIALIST', 'TEACHER', 'STUDENT'] as any[]), getTestById);

// POST /api/tests - Create new test
router.post('/', roleMiddleware(['ADMIN', 'SPECIALIST']), createTest);

// PATCH /api/tests/:id - Update test
router.patch('/:id', roleMiddleware(['ADMIN', 'SPECIALIST']), updateTest);

// PATCH /api/tests/:id/approve - Approve test (shallow - test only)
router.patch('/:id/approve', roleMiddleware(['ADMIN']), approveTest);

// PATCH /api/tests/:id/approve-full - Approve test + all parts + all questions (cascade)
router.patch('/:id/approve-full', roleMiddleware(['ADMIN']), approveTestFull);

// PATCH /api/tests/:id/reject - Reject test (ADMIN only)
router.patch('/:id/reject', roleMiddleware(['ADMIN']), rejectTest);

// PATCH /api/tests/:id/toggle-lock - Toggle test lock status
router.patch('/:id/toggle-lock', roleMiddleware(['ADMIN', 'SPECIALIST']), toggleTestLock);

// DELETE /api/tests/:id - Delete test
router.delete('/:id', roleMiddleware(['ADMIN', 'SPECIALIST']), deleteTest);

export default router;
