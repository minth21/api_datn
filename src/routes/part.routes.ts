import express from 'express';
import {
    getPartsByTestId,
    getPartById,
    createPart,
    updatePart,
    deletePart,
    approvePart,
    rejectPart,
    togglePartLock,
} from '../controllers/part.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = express.Router();

// Get all parts of a test
router.get('/tests/:testId/parts', authMiddleware, getPartsByTestId);

// Get part by ID
router.get('/parts/:partId', authMiddleware, getPartById);

// Create new part
router.post('/tests/:testId/parts', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), createPart);

// Update part
router.patch('/parts/:partId', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), updatePart);

// Approve part
router.patch('/parts/:partId/approve', authMiddleware, roleMiddleware(['ADMIN']), approvePart);

// Reject part
router.patch('/parts/:partId/reject', authMiddleware, roleMiddleware(['ADMIN']), rejectPart);

// Toggle part lock status
router.patch('/parts/:partId/toggle-lock', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), togglePartLock);

// Delete part
router.delete('/parts/:partId', authMiddleware, roleMiddleware(['ADMIN', 'SPECIALIST']), deletePart);

export default router;
