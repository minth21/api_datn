import express from 'express';
import {
    getTests,
    getTestById,
    createTest,
    updateTest,
    deleteTest,
} from '../controllers/test.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/tests - Get all tests
router.get('/', getTests);

// GET /api/tests/:id - Get test by ID
router.get('/:id', getTestById);

// POST /api/tests - Create new test
router.post('/', createTest);

// PATCH /api/tests/:id - Update test
router.patch('/:id', updateTest);

// DELETE /api/tests/:id - Delete test
router.delete('/:id', deleteTest);

export default router;
