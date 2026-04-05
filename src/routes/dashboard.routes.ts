import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Route: GET /api/dashboard/stats
// Protected by auth and role middleware (ADMIN & SPECIALIST allowed)
router.get('/stats', authMiddleware, roleMiddleware([Role.ADMIN, Role.SPECIALIST]), getDashboardStats);

export default router;
