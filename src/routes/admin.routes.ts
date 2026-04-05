import express from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

/**
 * POST /api/admin/users/auto
 * Chỉ ADMIN và SPECIALIST mới có quyền tạo tài khoản tự động (Sinh mã & Password mặc định) cho GV, CV, HV
 */
router.post(
    '/users/auto',
    authMiddleware,
    roleMiddleware([Role.ADMIN, Role.SPECIALIST]),
    adminController.createUserAuto
);

export default router;
