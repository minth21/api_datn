import express from 'express';
import { recommendationController } from '../controllers/recommendation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

/**
 * Recommendation Routes - Gợi ý bài tập cá nhân hóa
 */

// Yêu cầu đăng nhập học viên
router.get('/daily', authMiddleware, roleMiddleware([Role.STUDENT, Role.ADMIN]), recommendationController.getDailyRecommendations);

export default router;
