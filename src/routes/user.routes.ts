import express from 'express';
import {
    uploadUserAvatar,
    getUsers,
    getUserById,
    updateUserById,
    updateUserLevel,
    createUser,
} from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { uploadAvatar } from '../config/upload.config';

const router = express.Router();

/**
 * POST /api/users/avatar - Upload user avatar
 * Protected route - requires authentication
 */
router.post('/avatar', authMiddleware, uploadAvatar.single('avatar'), uploadUserAvatar);

/**
 * POST /api/users - Create new user (Admin only)
 * Admin only
 */
router.post('/', authMiddleware, adminMiddleware, createUser);

/**
 * GET /api/users - Lấy danh sách tất cả users
 * Admin only
 */
router.get('/', authMiddleware, adminMiddleware, getUsers);

/**
 * PATCH /api/users/level - Update user's TOEIC level
 * Protected route - requires authentication
 * NOTE: This must come BEFORE /:id route to avoid matching conflicts
 */
router.patch('/level', authMiddleware, updateUserLevel);

/**
 * GET /api/users/:id - Lấy thông tin chi tiết 1 user
 * Admin only
 */
router.get('/:id', authMiddleware, adminMiddleware, getUserById);

/**
 * PATCH /api/users/:id - Cập nhật thông tin user
 * Admin only
 */
router.patch('/:id', authMiddleware, adminMiddleware, updateUserById);

export default router;


