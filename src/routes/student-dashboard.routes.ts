import { Router } from 'express';
import { getStudentDashboard } from '../controllers/student-dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Route: GET /api/dashboard/student
router.get('/student', authMiddleware, getStudentDashboard);

export default router;
