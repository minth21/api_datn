import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const router = Router();

// Route: GET /api/dashboard/stats
// Protected by auth and admin middleware
router.get('/stats', authMiddleware, adminMiddleware, getDashboardStats);

export default router;
