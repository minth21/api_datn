import express from 'express';
import {
    getPartsByTestId,
    getPartById,
    createPart,
    updatePart,
    deletePart,
} from '../controllers/part.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// Get all parts of a test
router.get('/tests/:testId/parts', authMiddleware, getPartsByTestId);

// Get part by ID
router.get('/parts/:partId', authMiddleware, getPartById);

// Create new part
router.post('/tests/:testId/parts', authMiddleware, createPart);

// Update part
router.patch('/parts/:partId', authMiddleware, updatePart);

// Delete part
router.delete('/parts/:partId', authMiddleware, deletePart);

export default router;
